import { base } from '$app/paths';

type RefreshLoader = () => Promise<void>;

/** API surface used for per-route header refresh. */
export type PageRefreshTarget = {
	loadOverview: (opts?: { force?: boolean }) => Promise<void>;
	loadSettings: () => Promise<void>;
	loadAccountsSection: () => Promise<void>;
	loadFederationSection: () => Promise<void>;
	loadEndpointOverrides: () => Promise<void>;
	loadExchangers: () => Promise<void>;
};

export function normalizeRoutePath(pathname: string): string {
	let p = pathname;
	if (base) {
		p = pathname.replace(base, '') || '/';
	}
	return p.replace(/\/+$/, '') || '/';
}

/** Loaders required for the current page only (header refresh button). */
export function getPageRefreshLoaders(
	store: PageRefreshTarget,
	path: string,
): RefreshLoader[] {
	if (path === '/') {
		return [() => store.loadOverview({ force: true })];
	}

	if (path === '/services' || path === '/proxy' || path === '/ports') {
		return [() => store.loadSettings()];
	}

	if (path.startsWith('/accounts')) {
		const loaders: RefreshLoader[] = [() => store.loadAccountsSection()];
		if (path === '/accounts') {
			loaders.push(() => store.loadSettings());
		}
		return loaders;
	}

	if (path.startsWith('/federation')) {
		const loaders: RefreshLoader[] = [() => store.loadFederationSection()];
		if (path.endsWith('/endpoints')) {
			loaders.push(() => store.loadEndpointOverrides());
		} else if (path.endsWith('/exchangers')) {
			loaders.push(() => store.loadExchangers());
		}
		return loaders;
	}

	if (path === '/notice') {
		return [() => store.loadOverview({ force: true })];
	}

	// Unknown route — settings is the most common shared dependency
	return [() => store.loadSettings()];
}
