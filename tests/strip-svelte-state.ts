// Lets bun test import `state.svelte.ts` without Vite.
// `$state` is stripped, and `$lib/*` imports are pointed at test stubs.
// `adminPathApply` stays the real module. Imports inside an onLoad result are
// not sent back through onResolve, so the rewrite has to happen here.
import { dirname, join, relative } from 'node:path';
import { plugin } from 'bun';

const libRoot = join(import.meta.dir, '../src/lib');
const stubs = join(import.meta.dir, 'stubs/deps.ts');
const realApply = join(libRoot, 'adminPathApply.ts');

plugin({
    name: 'madmail-admin-web-test',
    setup(build) {
        build.onLoad({ filter: /\.svelte\.ts$/ }, async (args) => {
            const contents = (await Bun.file(args.path).text())
                .replace(/\$state(?:<[^>()]+>)?\(/g, '(')
                .replace(/from '(\$lib\/[^']+)'/g, (full, spec: string) => {
                    const target = spec === '$lib/adminPathApply' ? realApply : stubs;
                    if (!spec.startsWith('$lib/')) return full;
                    let rel = relative(dirname(args.path), target);
                    if (!rel.startsWith('.')) rel = `./${rel}`;
                    return `from '${rel}'`;
                });
            return { contents, loader: 'ts' };
        });
    },
});
