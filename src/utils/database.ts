/**
 * Prisma Client instance
 * Centralized database access for the entire application
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";

// Create Prisma adapter for better-sqlite3
const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL || "file:./db/dev.db",
});

// Initialize Prisma Client with adapter
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown
process.on("SIGTERM", async () => {
	await prisma.$disconnect();
	process.exit(0);
});
