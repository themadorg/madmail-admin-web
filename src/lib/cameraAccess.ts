const trackedStreams = new Set<MediaStream>();

/** Register a MediaStream so it can be stopped when login finishes. */
export function trackCameraStream(stream: MediaStream): void {
	trackedStreams.add(stream);
}

function stopMediaStream(stream: MediaStream): void {
	for (const track of stream.getTracks()) {
		track.stop();
	}
}

function stopVideoElements(): void {
	if (typeof document === 'undefined') return;
	for (const video of document.querySelectorAll('video')) {
		const src = video.srcObject;
		if (src instanceof MediaStream) {
			stopMediaStream(src);
			video.srcObject = null;
		}
	}
}

/** Stop any active camera tracks and try to drop the site camera permission. */
export async function releaseCameraAccess(): Promise<void> {
	for (const stream of trackedStreams) {
		stopMediaStream(stream);
	}
	trackedStreams.clear();
	stopVideoElements();

	const permissions = navigator.permissions as Permissions & {
		revoke?: (descriptor: PermissionDescriptor) => Promise<PermissionStatus>;
	};
	if (!permissions?.revoke) return;

	try {
		await permissions.revoke({ name: 'camera' as PermissionName });
	} catch {
		/* revoke is optional — user can clear permission in browser settings */
	}
}
