export const LOGO_SECRET_LABEL = "madmail";
export const LOGO_SECRET_TITLE = "madmail v2";

const GLITCH_CHARS = "0126789@#$%&*_\\|/<>[]{}!?~";

export type LogoSecretGlitchOptions = {
	getTitle: () => string;
	onUpdate: (text: string) => void;
	isPaused?: () => boolean;
	intervalMs?: number;
};

function pickGlitchChar(): string {
	return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]!;
}

export function glitchScramble(source: string, intensity: number): string {
	return source
		.split("")
		.map((ch) =>
			ch === " "
				? " "
				: Math.random() < intensity
					? pickGlitchChar()
					: ch,
		)
		.join("");
}

/** Random hacker-style char flicker while the easter egg is open. */
export function createLogoSecretGlitch(
	options: LogoSecretGlitchOptions,
): () => void {
	const { getTitle, onUpdate, isPaused, intervalMs = 75 } = options;

	onUpdate(getTitle());

	let frame = 0;
	const id = window.setInterval(() => {
		if (isPaused?.()) return;

		frame++;
		const title = getTitle();

		const inBurst = frame % 52 < 11 || frame % 130 < 5;
		if (inBurst) {
			onUpdate(glitchScramble(title, 0.3 + Math.random() * 0.6));
		} else if (Math.random() < 0.14) {
			onUpdate(glitchScramble(title, 0.12 + Math.random() * 0.25));
		} else {
			onUpdate(title);
		}
	}, intervalMs);

	return () => {
		window.clearInterval(id);
		onUpdate(getTitle());
	};
}
