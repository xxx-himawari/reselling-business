import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const directory = resolve("work/local-postgres");
mkdirSync(directory, { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  port: 54329,
  user: "reselling",
  password: "local_dev_only",
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
});
async function main() {
  const existing = existsSync(resolve(directory, "PG_VERSION"));
  if (!existing) await pg.initialise();
  await pg.start();
  if (!existing) await pg.createDatabase("reselling");
  console.log(
    "Local PostgreSQL ready on 127.0.0.1:54329. Data persists under work/local-postgres. Ctrl+C to stop.",
  );
  await new Promise<void>((resolveStop) => {
    process.once("SIGINT", () => resolveStop());
    process.once("SIGTERM", () => resolveStop());
  });
  await pg.stop();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
