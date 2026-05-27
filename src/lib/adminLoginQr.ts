/** Legacy query params (still accepted when parsing old QR codes). */
export const LOGIN_URL_PARAM = 'madmail_u';
export const LOGIN_TOKEN_PARAM = 'madmail_t';

export interface AdminLoginCredentials {
	url: string;
	token: string;
}

interface LoginPayload {
	u: string;
	t: string;
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): Uint8Array | null {
	try {
		const padded =
			encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(
				encoded.length + ((4 - (encoded.length % 4)) % 4),
				'=',
			);
		const binary = atob(padded);
		return Uint8Array.from(binary, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

/** Encode credentials as a base64url JSON blob for `#…` login links / QR codes. */
export function encodeLoginHash(apiUrl: string, token: string): string {
	const json = JSON.stringify({ u: apiUrl, t: token } satisfies LoginPayload);
	return toBase64Url(new TextEncoder().encode(json));
}

function decodeLoginHash(encoded: string): AdminLoginCredentials | null {
	const bytes = fromBase64Url(encoded.trim());
	if (!bytes) return null;
	try {
		const j = JSON.parse(new TextDecoder().decode(bytes)) as LoginPayload;
		if (j.u && j.t) return { url: j.u, token: j.t };
	} catch {
		/* invalid payload */
	}
	return null;
}

/** Build login URL: `https://admin.madmail.chat/#<base64>` */
export function buildAdminLoginQrUrl(
	webOrigin: string,
	apiUrl: string,
	token: string,
): string {
	const origin = webOrigin.replace(/\/+$/, '');
	return `${origin}/#${encodeLoginHash(apiUrl, token)}`;
}

export function parseAdminLoginQrPayload(raw: string): AdminLoginCredentials | null {
	const text = raw.trim();
	if (!text) return null;

	// Full URL or fragment — prefer `#base64` login hash
	try {
		const u = new URL(text, typeof window !== 'undefined' ? window.location.href : undefined);
		const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
		if (hash) {
			const creds = decodeLoginHash(hash);
			if (creds) return creds;
		}
		// Legacy query params
		const url = u.searchParams.get(LOGIN_URL_PARAM) ?? u.searchParams.get('u');
		const token = u.searchParams.get(LOGIN_TOKEN_PARAM) ?? u.searchParams.get('t');
		if (url && token) return { url, token };
	} catch {
		/* not a URL — try raw base64 below */
	}

	// Raw base64 hash payload (scanner may return only the fragment body)
	const creds = decodeLoginHash(text.startsWith('#') ? text.slice(1) : text);
	if (creds) return creds;

	// madmail-admin://connect?u=…&t=…
	if (text.startsWith('madmail-admin://')) {
		const q = text.indexOf('?');
		if (q >= 0) {
			const params = new URLSearchParams(text.slice(q + 1));
			const url = params.get('u') ?? params.get(LOGIN_URL_PARAM);
			const token = params.get('t') ?? params.get(LOGIN_TOKEN_PARAM);
			if (url && token) return { url, token };
		}
	}

	// Plain JSON { "u", "t" }
	try {
		const j = JSON.parse(text) as Record<string, string>;
		const url = j.u ?? j.url;
		const token = j.t ?? j.token;
		if (url && token) return { url, token };
	} catch {
		/* not JSON */
	}

	return null;
}

/** Read `#base64` login hash (or legacy query params) and clear it from the address bar. */
export function consumeLoginFromLocation(loc: Location): AdminLoginCredentials | null {
	const hash = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash;
	if (hash) {
		const creds = decodeLoginHash(hash);
		if (creds) {
			history.replaceState({}, '', loc.pathname + loc.search);
			return creds;
		}
	}

	const params = new URLSearchParams(loc.search);
	const url = params.get(LOGIN_URL_PARAM);
	const token = params.get(LOGIN_TOKEN_PARAM);
	if (!url || !token) return null;

	params.delete(LOGIN_URL_PARAM);
	params.delete(LOGIN_TOKEN_PARAM);
	const qs = params.toString();
	history.replaceState({}, '', loc.pathname + (qs ? `?${qs}` : '') + loc.hash);
	return { url, token };
}

/** @deprecated Use {@link consumeLoginFromLocation} */
export const consumeLoginQueryFromLocation = consumeLoginFromLocation;
