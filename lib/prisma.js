/**
 * Prisma Client Configuration
 *
 * Singleton pattern for Prisma client to prevent multiple instances
 * during development with hot-reloading
 */

const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances during development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
