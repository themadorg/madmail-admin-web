export type DoubleTapOptions = {
	onDouble: (e: Event) => void;
	/** Called after the interval if no second tap (touch only). */
	onSingle?: () => void;
	/** Max ms between taps (default 320). */
	interval?: number;
};

/**
 * Double-click (mouse) or double-tap (touch) on links/buttons.
 * Touch: delays single-tap action until interval passes so double-tap can win.
 */
export function doubleTap(node: HTMLElement, options: DoubleTapOptions) {
	const interval = options.interval ?? 320;
	let lastTouchEnd = 0;
	let singleTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressClick = false;

	const clearSingle = () => {
		if (singleTimer !== null) {
			clearTimeout(singleTimer);
			singleTimer = null;
		}
	};

	const onTouchEnd = (e: TouchEvent) => {
		if (e.changedTouches.length !== 1) return;

		const now = Date.now();
		if (lastTouchEnd > 0 && now - lastTouchEnd < interval) {
			e.preventDefault();
			clearSingle();
			lastTouchEnd = 0;
			suppressClick = true;
			options.onDouble(e);
			return;
		}

		lastTouchEnd = now;
		clearSingle();
		e.preventDefault();

		singleTimer = setTimeout(() => {
			singleTimer = null;
			lastTouchEnd = 0;
			options.onSingle?.();
		}, interval);
	};

	const onClickCapture = (e: MouseEvent) => {
		if (suppressClick) {
			e.preventDefault();
			e.stopImmediatePropagation();
			suppressClick = false;
		}
	};

	const onDblClick = (e: MouseEvent) => {
		e.preventDefault();
		clearSingle();
		lastTouchEnd = 0;
		options.onDouble(e);
	};

	node.addEventListener("touchend", onTouchEnd, { passive: false });
	node.addEventListener("click", onClickCapture, true);
	node.addEventListener("dblclick", onDblClick);

	return {
		destroy() {
			clearSingle();
			node.removeEventListener("touchend", onTouchEnd);
			node.removeEventListener("click", onClickCapture, true);
			node.removeEventListener("dblclick", onDblClick);
		},
	};
}
