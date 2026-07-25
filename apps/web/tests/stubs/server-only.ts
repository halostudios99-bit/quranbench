// In Next.js `server-only` resolves to an empty module inside Server Components
// and throws inside Client Components. Vitest is neither, so we alias the bare
// specifier to this no-op stub, letting server modules be unit-tested directly.
export {};
