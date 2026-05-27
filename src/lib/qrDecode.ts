import jsQR from 'jsqr';

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not load image'));
		};
		img.src = url;
	});
}

function drawToCanvas(
	img: CanvasImageSource,
	width: number,
	height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Canvas not supported');
	ctx.drawImage(img, 0, 0, width, height);
	return { canvas, ctx };
}

function decodeWithJsQr(ctx: CanvasRenderingContext2D, width: number, height: number): string | null {
	const imageData = ctx.getImageData(0, 0, width, height);
	const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
	return code?.data ?? null;
}

async function decodeWithBarcodeDetector(source: ImageBitmapSource): Promise<string | null> {
	if (!('BarcodeDetector' in globalThis)) return null;
	try {
		// BarcodeDetector is not in all TS lib.dom versions yet.
		const BarcodeDetectorCtor = (
			globalThis as typeof globalThis & {
				BarcodeDetector: new (opts: { formats: string[] }) => {
					detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
				};
			}
		).BarcodeDetector;
		const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
		const codes = await detector.detect(source);
		return codes[0]?.rawValue ?? null;
	} catch {
		return null;
	}
}

async function decodeFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
	const bitmap = await createImageBitmap(canvas);
	try {
		const native = await decodeWithBarcodeDetector(bitmap);
		if (native) return native;
	} finally {
		bitmap.close();
	}

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return null;
	return decodeWithJsQr(ctx, canvas.width, canvas.height);
}

/** Decode a QR code from a still image using several strategies. */
export async function decodeQrFromImageFile(file: File): Promise<string> {
	const img = await loadImageFromFile(file);
	const maxDim = 2048;
	const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
	const baseW = Math.max(1, Math.round(img.naturalWidth * scale));
	const baseH = Math.max(1, Math.round(img.naturalHeight * scale));
	const base = drawToCanvas(img, baseW, baseH);

	let decoded = await decodeFromCanvas(base.canvas);
	if (decoded) return decoded;

	// jsQR often works better when the code occupies more pixels.
	for (const factor of [1.5, 2, 0.75, 0.5]) {
		const w = Math.round(baseW * factor);
		const h = Math.round(baseH * factor);
		if (w < 120 || h < 120 || w > 4096 || h > 4096) continue;
		const scaled = drawToCanvas(base.canvas, w, h);
		decoded = await decodeFromCanvas(scaled.canvas);
		if (decoded) return decoded;
	}

	// Last resort: html5-qrcode file scan.
	const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
	const tempId = 'madmail-login-qr-file-decode';
	let mount = document.getElementById(tempId);
	if (!mount) {
		mount = document.createElement('div');
		mount.id = tempId;
		mount.hidden = true;
		document.body.appendChild(mount);
	}
	const reader = new Html5Qrcode(tempId, {
		formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
		verbose: false,
	});
	return reader.scanFile(file, false);
}
