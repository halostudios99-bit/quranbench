import 'server-only';

import { PrismaClient } from '@prisma/client';

// A single PrismaClient per process, cached across dev hot reloads exactly as the
// corpus singleton is. Never import this from the domain layer or from tests —
// the rules talk to the Store port, not to Prisma.
const globalForPrisma = globalThis as unknown as { __qbPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__qbPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__qbPrisma = prisma;
