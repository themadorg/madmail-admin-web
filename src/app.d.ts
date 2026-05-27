// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	const __APP_VERSION__: string;
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

interface ImportMetaEnv {
	readonly VITE_DEV_API_PROXY?: string;
	readonly VITE_DEV_API_PATH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export { };
