import { LOGO_SECRET_LABEL } from "$lib/logoSecretGlitch";
import type { LogoSecretAccent } from "$lib/logoSecretAccent";

const GOLDEN_WORD = LOGO_SECRET_LABEL;
const GOLDEN_DURATION_MS = 1600;

const PALETTES: Record<
	LogoSecretAccent,
	{ head: string; trail: (fade: number) => string }
> = {
	red: {
		head: "#ffd1d1",
		trail: (fade) => `rgba(255, 40, 40, ${0.06 + fade * 0.42})`,
	},
	blue: {
		head: "#c7d2fe",
		trail: (fade) => `rgba(99, 102, 241, ${0.06 + fade * 0.42})`,
	},
};

export type MatrixRainOptions = {
	accent: LogoSecretAccent;
	goldenFlashSeq?: number;
	/** Vertical rain text, e.g. "madmail." or "madmail". */
	rainWord?: string;
};

/** Full-screen Matrix rain — vertical falling text columns. */
export function matrixRain(
	node: HTMLCanvasElement,
	options: MatrixRainOptions = { accent: "red" },
) {
	const ctx0 = node.getContext("2d");
	if (!ctx0) return { destroy() {} };
	const ctx: CanvasRenderingContext2D = ctx0;

	let currentAccent = options.accent;
	let rainWord = options.rainWord ?? `${LOGO_SECRET_LABEL}.`;
	let lastGoldenSeq = options.goldenFlashSeq ?? 0;
	let animationId = 0;
	let fontSize = 16;
	let columns: number[] = [];
	let speeds: number[] = [];
	let phases: number[] = [];
	/** Per-column golden mode expiry (ms timestamp). */
	let goldenUntil: number[] = [];
	let reducedMotion = false;

	function wordLen() {
		return rainWord.length;
	}

	function charAt(row: number, phase: number, word: string): string {
		const len = word.length;
		const idx = ((Math.floor(row) % len) + phase + len * 64) % len;
		return word[idx]!;
	}

	function goldenCharAt(headRow: number, row: number): string | null {
		const idx = Math.floor(headRow) - Math.floor(row);
		if (idx < 0 || idx >= GOLDEN_WORD.length) return null;
		return GOLDEN_WORD[idx]!;
	}

	function isGoldenColumn(i: number, now: number): boolean {
		return (goldenUntil[i] ?? 0) > now;
	}

	function triggerGoldenMadmail() {
		if (columns.length === 0) return;
		const column = Math.floor(Math.random() * columns.length);
		goldenUntil[column] = performance.now() + GOLDEN_DURATION_MS;
		columns[column] = -GOLDEN_WORD.length - Math.floor(Math.random() * 3);
		phases[column] = 0;
		speeds[column] = 0.45 + Math.random() * 0.35;
	}

	function resize() {
		const parent = node.parentElement;
		if (!parent) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = parent.clientWidth;
		const h = parent.clientHeight;

		node.width = Math.floor(w * dpr);
		node.height = Math.floor(h * dpr);
		node.style.width = `${w}px`;
		node.style.height = `${h}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const count = Math.ceil(w / fontSize);
		const len = wordLen();
		columns = Array.from(
			{ length: count },
			() => -Math.random() * (h / fontSize),
		);
		speeds = Array.from({ length: count }, () => 0.35 + Math.random() * 0.85);
		phases = Array.from({ length: count }, () =>
			Math.floor(Math.random() * len),
		);
		goldenUntil = Array.from({ length: count }, () => 0);
	}

	function drawStatic() {
		const w = node.clientWidth;
		const h = node.clientHeight;
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, w, h);
	}

	function draw() {
		const w = node.clientWidth;
		const h = node.clientHeight;
		const palette = PALETTES[currentAccent];
		const now = performance.now();
		const len = wordLen();

		ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
		ctx.fillRect(0, 0, w, h);

		ctx.font = `${fontSize}px ui-monospace, monospace`;

		for (let i = 0; i < columns.length; i++) {
			const x = i * fontSize;
			const headRow = columns[i]!;
			const phase = phases[i]!;
			const golden = isGoldenColumn(i, now);
			const trailLen = golden
				? GOLDEN_WORD.length + 4
				: 12 + (i % 5) * 2;

			if (golden) {
				ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
			}

			for (let t = 0; t < trailLen; t++) {
				const row = Math.floor(headRow) - t;
				const y = row * fontSize;
				if (y < -fontSize || y > h + fontSize) continue;

				if (golden) {
					const ch = goldenCharAt(headRow, row);
					if (!ch) continue;

					const elapsed = goldenUntil[i]! - now;
					const fade = Math.min(1, elapsed / (GOLDEN_DURATION_MS * 0.75));
					if (t === 0) {
						ctx.fillStyle = `rgba(255, 220, 120, ${0.85 + fade * 0.15})`;
						ctx.shadowColor = "rgba(251, 191, 36, 0.95)";
						ctx.shadowBlur = 12;
					} else {
						ctx.shadowBlur = 0;
						const trailFade = 1 - t / trailLen;
						ctx.fillStyle = `rgba(251, 191, 36, ${(0.2 + trailFade * 0.55) * fade})`;
					}
					ctx.fillText(ch, x, y);
					continue;
				}

				const ch = charAt(row, phase, rainWord);
				if (t === 0) {
					ctx.fillStyle = palette.head;
				} else {
					const fade = 1 - t / trailLen;
					ctx.fillStyle = palette.trail(fade);
				}
				ctx.fillText(ch, x, y);
			}

			ctx.shadowBlur = 0;
			ctx.font = `${fontSize}px ui-monospace, monospace`;

			columns[i]! += speeds[i]!;

			if (!golden && headRow * fontSize > h + fontSize && Math.random() > 0.975) {
				columns[i] = -trailLen - Math.random() * 8;
				speeds[i] = 0.35 + Math.random() * 0.85;
				phases[i] = Math.floor(Math.random() * len);
			}
		}

		animationId = requestAnimationFrame(draw);
	}

	function start() {
		cancelAnimationFrame(animationId);
		resize();
		reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reducedMotion) {
			drawStatic();
			return;
		}
		draw();
	}

	function applyGoldenSeq(seq: number | undefined) {
		if (seq === undefined || seq === lastGoldenSeq) return;
		const delta = seq - lastGoldenSeq;
		lastGoldenSeq = seq;
		for (let j = 0; j < delta; j++) triggerGoldenMadmail();
	}

	const ro = new ResizeObserver(start);
	const parent = node.parentElement;
	if (parent) ro.observe(parent);

	applyGoldenSeq(options.goldenFlashSeq);
	start();

	return {
		update(next: MatrixRainOptions) {
			const word = next.rainWord ?? `${LOGO_SECRET_LABEL}.`;
			if (word !== rainWord) {
				rainWord = word;
				start();
			}
			currentAccent = next.accent;
			applyGoldenSeq(next.goldenFlashSeq);
		},
		destroy() {
			cancelAnimationFrame(animationId);
			ro.disconnect();
			goldenUntil = [];
		},
	};
}
