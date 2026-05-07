import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

const prismaDir = path.dirname(new URL(import.meta.url).pathname);
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

if (!databaseUrl.startsWith("file:")) {
  console.error("The bundled initializer supports SQLite file: DATABASE_URL values.");
  console.error("For PostgreSQL, replace this script with `prisma db push` after changing the Prisma datasource provider.");
  process.exit(1);
}

const rawPath = databaseUrl.replace("file:", "");
const dbPath = path.resolve(prismaDir, rawPath);
const schemaPath = path.join(prismaDir, "schema.sql");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const result = spawnSync("sqlite3", [dbPath, `.read ${schemaPath}`], {
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
