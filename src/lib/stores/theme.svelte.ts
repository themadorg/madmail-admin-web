/** Theme mode persisted in localStorage and applied via `data-theme` on `<html>`. */

import { applyLogoSecretAccent } from '$lib/logoSecretAccent';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'madmail_theme';

const THEME_COLORS: Record<ThemeMode, string> = {
	dark: '#111113',
	light: '#f8f9fa',
};

function readStoredTheme(): ThemeMode {
	if (typeof localStorage === 'undefined') return 'dark';
	return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(mode: ThemeMode): void {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', mode);
	const meta = document.querySelector('meta[name="theme-color"]');
	meta?.setAttribute('content', THEME_COLORS[mode]);
	applyLogoSecretAccent(mode);
}

class ThemeStore {
	mode = $state<ThemeMode>('dark');
	private initialized = false;

	init(): void {
		if (this.initialized) return;
		this.initialized = true;
		this.mode = readStoredTheme();
		applyTheme(this.mode);
	}

	get isDark(): boolean {
		return this.mode === 'dark';
	}

	toggle(): void {
		this.set(this.isDark ? 'light' : 'dark');
	}

	set(mode: ThemeMode): void {
		this.mode = mode;
		applyTheme(mode);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, mode);
		}
	}
}

export const theme = new ThemeStore();
