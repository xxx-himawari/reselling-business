import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { execFileSync, spawn, ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  return port;
}
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "reselling-phase1-test-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: join(directory, "pg"),
    port,
    user: "phase1_test",
    password: "isolated_test_only",
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://phase1_test:isolated_test_only@127.0.0.1:${port}/reselling_test?schema=public`,
  };
  const run = (file: string, args: string[]) =>
    execFileSync(process.execPath, [file, ...args], { env, stdio: "inherit" });
  let db: PrismaClient | undefined;
  let running = false;
  let web: ChildProcess | undefined;
  try {
    await pg.initialise();
    await pg.start();
    running = true;
    await pg.createDatabase("reselling_test");
    run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
    run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
    run("node_modules/vitest/vitest.mjs", ["run", "tests/integration"]);
    const webPort = await freePort();
    const base = `http://127.0.0.1:${webPort}`;
    web = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        String(webPort),
      ],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let logs = "";
    web.stdout?.on("data", (c) => (logs += c));
    web.stderr?.on("data", (c) => (logs += c));
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        if ((await fetch(base)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) throw new Error("Production server did not start: " + logs);
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/http-smoke.ts"],
      { env: { ...env, SMOKE_BASE_URL: base }, stdio: "inherit" },
    );
    web.kill("SIGTERM");
    await new Promise<void>((resolve) => web!.once("exit", () => resolve()));
    web = undefined;
    db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
    const marker = await db.product.create({
      data: { name: "restart persistence marker" },
    });
    const goal = await db.goal.findFirstOrThrow();
    const goalAmount = goal.targetProfit.toFixed();
    const counts = await Promise.all([
      db.product.count(),
      db.supplierProposal.count(),
      db.sourcingPlan.count(),
    ]);
    await db.$disconnect();
    db = undefined;
    await pg.stop();
    running = false;
    await pg.start();
    running = true;
    db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
    assert.equal(
      (await db.product.findUniqueOrThrow({ where: { id: marker.id } })).name,
      marker.name,
    );
    assert.equal(
      (
        await db.goal.findUniqueOrThrow({ where: { id: goal.id } })
      ).targetProfit.toFixed(),
      goalAmount,
    );
    assert.deepEqual(
      await Promise.all([
        db.product.count(),
        db.supplierProposal.count(),
        db.sourcingPlan.count(),
      ]),
      counts,
    );
    console.log(
      "PASS: PostgreSQL process stop/start preserves products, proposals, plans and Decimal goal values",
    );
  } finally {
    if (web) web.kill("SIGTERM");
    if (db) await db.$disconnect();
    if (running) await pg.stop();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
