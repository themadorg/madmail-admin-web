/** Build inline CSS vars for the login → header logo morph keyframes. */
export function buildLogoMorphStyle(from: DOMRect, to: DOMRect): string {
	const tx = from.left - to.left + (from.width - to.width) / 2;
	const ty = from.top - to.top + (from.height - to.height) / 2;
	const sx = from.width / to.width;
	const sy = from.height / to.height;

	return [
		`left:${to.left}px`,
		`top:${to.top}px`,
		`width:${to.width}px`,
		`height:${to.height}px`,
		`--logo-morph-tx:${tx}px`,
		`--logo-morph-ty:${ty}px`,
		`--logo-morph-sx:${sx}`,
		`--logo-morph-sy:${sy}`,
	].join(';');
}
