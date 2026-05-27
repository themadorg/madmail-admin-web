import type { ThemeMode } from '$lib/stores/theme.svelte';

const STORAGE_KEY = 'madmail_logo_secret_accent';
const LEGACY_KEY = 'madmail_logo_secret';

export type LogoSecretAccent = 'blue' | 'red';

const RED_ACCENT: Record<ThemeMode, { accent: string; accentDim: string }> = {
	dark: { accent: '#f87171', accentDim: '#ef4444' },
	light: { accent: '#dc2626', accentDim: '#b91c1c' },
};

function migrateLegacyUnlock(): void {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(STORAGE_KEY)) return;
	if (localStorage.getItem(LEGACY_KEY) === '1') {
		localStorage.setItem(STORAGE_KEY, 'red');
		localStorage.removeItem(LEGACY_KEY);
	}
}

export function getLogoSecretAccent(): LogoSecretAccent | null {
	if (typeof localStorage === 'undefined') return null;
	migrateLegacyUnlock();
	const v = localStorage.getItem(STORAGE_KEY);
	if (v === 'red' || v === 'blue') return v;
	return null;
}

export function isLogoSecretUnlocked(): boolean {
	return getLogoSecretAccent() !== null;
}

export function setLogoSecretAccent(accent: LogoSecretAccent): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, accent);
}

/** First open: persist unlock with red selected. Returns true if newly unlocked. */
export function unlockLogoSecretAccent(): boolean {
	if (getLogoSecretAccent() !== null) return false;
	setLogoSecretAccent('red');
	return true;
}

export function applyLogoSecretAccent(mode: ThemeMode): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (getLogoSecretAccent() !== 'red') {
		root.style.removeProperty('--th-accent');
		root.style.removeProperty('--th-accent-dim');
		return;
	}
	const { accent, accentDim } = RED_ACCENT[mode];
	root.style.setProperty('--th-accent', accent);
	root.style.setProperty('--th-accent-dim', accentDim);
}
