import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const proxyTarget = env.DEV_API_PROXY_TARGET?.replace(/\/+$/, '');
    const apiPath = (env.VITE_DEV_API_PATH || '/api/admin').replace(/\/+$/, '') || '/api/admin';

    return {
        plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version)
        },
        server: proxyTarget
            ? {
                  proxy: {
                      [apiPath]: {
                          target: proxyTarget,
                          changeOrigin: true,
                          secure: false
                      }
                  }
              }
            : undefined
    };
});
