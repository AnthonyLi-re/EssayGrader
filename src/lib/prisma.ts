// Use require instead of import to avoid TypeScript issues
const { PrismaClient } = require('@prisma/client')

// To prevent multiple instances in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// Initialize Prisma client
export const prisma = 
  globalForPrisma.prisma || 
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

// Save the client in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma 