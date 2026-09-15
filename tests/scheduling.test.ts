import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SWEEP_CRON,
  SWEEP_SCHEDULE_ID,
  VERCEL_DAILY_CRON,
} from "@/lib/queue/qstash";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

/**
 * Recurring work is split across two schedulers for one reason: Vercel's Hobby
 * plan refuses to deploy a cron that runs more than once a day. A `vercel.json`
 * that quietly drifts back to `*∕15 * * * *` does not fail a type check or a
 * build — it fails the *deploy*, which is the worst place to find out.
 *
 * So the split is pinned here.
 */
describe("the Vercel cron stays within the Hobby plan", () => {
  const vercel = JSON.parse(read("vercel.json")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  it("declares the sweep", () => {
    expect(vercel.crons).toBeDefined();
    expect(vercel.crons?.map((entry) => entry.path)).toContain(
      "/api/cron/sweep-emails",
    );
  });

  it("runs no cron more than once a day", () => {
    for (const cron of vercel.crons ?? []) {
      const [minute, hour] = cron.schedule.trim().split(/\s+/);

      // Anything but a single fixed value in these two fields means more than
      // one run per day: `*`, `*/15`, `1,31` and `9-17` all repeat.
      for (const [name, field] of [
        ["minute", minute],
        ["hour", hour],
      ] as const) {
        expect(
          field,
          `${cron.path}: "${cron.schedule}" repeats within a day (${name} = "${field}"). ` +
            "Hobby allows one run per day; put the frequent run in QStash instead.",
        ).toMatch(/^\d+$/);
      }
    }
  });

  it("uses the daily expression the code advertises", () => {
    // The health page tells operators what the daily run is; it must be true.
    expect(vercel.crons?.[0]?.schedule).toBe(VERCEL_DAILY_CRON);
  });
});

describe("the QStash schedule carries the frequent sweep", () => {
  const script = read("scripts/qstash-schedules.ts");

  it("is registered under a fixed id, so re-running cannot stack duplicates", () => {
    expect(script).toContain(`const SCHEDULE_ID = "${SWEEP_SCHEDULE_ID}"`);
    expect(script).toContain("scheduleId: SCHEDULE_ID");
  });

  it("targets the same endpoint Vercel Cron does", () => {
    expect(script).toContain("/api/cron/sweep-emails");
  });

  it("runs more often than the Vercel cron it is compensating for", () => {
    expect(script).toContain(`const DEFAULT_CRON = "${DEFAULT_SWEEP_CRON}"`);
    // A sub-daily expression is the whole point of the second scheduler.
    expect(DEFAULT_SWEEP_CRON.split(/\s+/)[0]).not.toMatch(/^\d+$/);
  });

  it("refuses to point QStash at a URL it cannot reach", () => {
    // QStash calls in over the internet, so a localhost APP_URL silently
    // registers a schedule that can never fire.
    expect(script).toContain("localhost");
    expect(script).toContain("throw new Error");
  });

  it("posts, because the sweep route authenticates POST by signature", () => {
    expect(script).toContain('method: "POST"');
    expect(read("app/api/cron/sweep-emails/route.ts")).toContain(
      "export async function POST",
    );
  });
});
