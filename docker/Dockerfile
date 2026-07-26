# syntax=docker/dockerfile:1
#
# Production image for the quranbench web app. Multi-stage: a full dependency
# install and Next build, then a lean runner that ships only the standalone
# server, its traced node_modules, the built assets, the corpus artifacts and the
# docs the app reads at runtime. The corpus is baked in, so a running container is
# a reproducible unit of one specific corpus version (CLAUDE.md, docs/deployment.md).
#
# Build context is the repository root:
#   docker build -f docker/Dockerfile -t quranbench-web .

# ── deps: install the workspace from the frozen lockfile ──────────────────────
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
# Copy only manifests first so this layer caches unless a dependency changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/corpus/package.json packages/corpus/
COPY packages/search/package.json packages/search/
COPY packages/audit/package.json packages/audit/
COPY packages/mcp/package.json packages/mcp/
RUN pnpm install --frozen-lockfile

# ── build: generate the Prisma client and build the standalone server ─────────
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @quranbench/web exec prisma generate
RUN pnpm --filter @quranbench/web build

# ── runner: the minimal image that actually runs in production ────────────────
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# The standalone server bundles its own node_modules under the tracing root, so
# copying it lays down /app/node_modules and /app/apps/web/server.js.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

# Runtime file reads resolve relative to the server's working directory
# (/app/apps/web), exactly as in development: ../../packages/corpus-build/out for
# the corpus, ../../docs for the contributor terms. Bake both.
COPY --from=build /repo/packages/corpus-build/out ./packages/corpus-build/out
COPY --from=build /repo/docs ./docs

# Run as the unprivileged built-in `node` user.
USER node

EXPOSE 3000
WORKDIR /app/apps/web

# Healthy = process up and the in-memory corpus loaded (see /api/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
