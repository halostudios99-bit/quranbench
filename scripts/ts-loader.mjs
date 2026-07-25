// Minimal, dependency-free ESM resolve hook so plain `node` can run the
// workspace's TypeScript scripts (audit runner, seed script) the same way
// Vitest does: it maps `@quranbench/<pkg>` to that package's src entry and
// rewrites `./x.js` specifiers to `./x.ts` when only the .ts exists. Node 24
// strips the type annotations itself. This is tooling only — never imported by
// the app or the packages.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@quranbench/')) {
    const rest = specifier.slice('@quranbench/'.length);
    const [pkg, ...sub] = rest.split('/');
    const base = path.join(ROOT, 'packages', pkg, 'src');
    const target = sub.length ? path.join(base, ...sub) : path.join(base, 'index.ts');
    const withExt = existsSync(target) ? target : `${target}.ts`;
    if (existsSync(withExt)) {
      return { url: pathToFileURL(withExt).href, shortCircuit: true };
    }
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const abs = fileURLToPath(new URL(specifier, context.parentURL));
    // ./x.js → ./x.ts
    const jsToTs = abs.replace(/\.js$/, '.ts');
    if (specifier.endsWith('.js') && existsSync(jsToTs)) {
      return { url: pathToFileURL(jsToTs).href, shortCircuit: true };
    }
    // extensionless ./x → ./x.ts or ./x/index.ts (Next/bundler style)
    if (!/\.[mc]?[jt]s$/.test(specifier)) {
      for (const cand of [`${abs}.ts`, path.join(abs, 'index.ts')]) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
