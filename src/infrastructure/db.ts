import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { resellingDb?: PrismaClient };
export const db = globalDb.resellingDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.resellingDb = db;
