/** Horizontal drag-to-scroll for overflow containers (touch + mouse grab). */
export type DragScrollOptions = {
	/** Pixels before pointer movement counts as a drag (default 8). */
	threshold?: number;
};

export function dragScroll(node: HTMLElement, options: DragScrollOptions = {}) {
	const threshold = options.threshold ?? 8;

	let activePointer: number | null = null;
	let startX = 0;
	let startScrollLeft = 0;
	let dragging = false;

	const canScroll = () => node.scrollWidth > node.clientWidth + 1;

	const suppressNextClick = () => {
		const onClick = (ev: MouseEvent) => {
			ev.preventDefault();
			ev.stopImmediatePropagation();
			node.removeEventListener('click', onClick, true);
		};
		node.addEventListener('click', onClick, true);
		window.setTimeout(
			() => node.removeEventListener('click', onClick, true),
			400,
		);
	};

	const onPointerDown = (e: PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (!canScroll()) return;

		activePointer = e.pointerId;
		startX = e.clientX;
		startScrollLeft = node.scrollLeft;
		dragging = false;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (activePointer !== e.pointerId) return;

		const dx = e.clientX - startX;
		if (!dragging) {
			if (Math.abs(dx) < threshold) return;
			dragging = true;
			node.classList.add('is-drag-scrolling');
			node.setPointerCapture(e.pointerId);
		}

		e.preventDefault();
		node.scrollLeft = startScrollLeft - dx;
	};

	const onPointerUp = (e: PointerEvent) => {
		if (activePointer !== e.pointerId) return;

		const wasDragging = dragging;
		activePointer = null;
		dragging = false;
		node.classList.remove('is-drag-scrolling');

		if (node.hasPointerCapture(e.pointerId)) {
			node.releasePointerCapture(e.pointerId);
		}

		if (wasDragging) {
			suppressNextClick();
		}
	};

	const onDragStart = (e: DragEvent) => {
		e.preventDefault();
	};

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove, { passive: false });
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerUp);
	node.addEventListener('dragstart', onDragStart);

	return {
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerUp);
			node.removeEventListener('dragstart', onDragStart);
		},
	};
}
