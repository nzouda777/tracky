/**
 * Registers the recurring jobs that Vercel Cron cannot run often enough.
 *
 * Vercel's Hobby plan allows one cron run per day. `vercel.json` claims that
 * daily run; everything more frequent lives in Upstash QStash, and this script
 * is how it gets there.
 *
 *   npm run qstash:setup     create or update the schedules
 *   npm run qstash:list      show what QStash currently has
 *   npm run qstash:remove    delete the schedules this script owns
 *
 * It is safe to re-run: each schedule is created with a fixed `scheduleId`,
 * which QStash treats as an upsert, so repeated runs update the one schedule
 * instead of stacking up duplicates.
 *
 * Requires QSTASH_TOKEN, CRON_SECRET and APP_URL. APP_URL must be the
 * deployment QStash should call — it cannot reach localhost.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { Client, type Schedule } from "@upstash/qstash";

const SCHEDULE_ID = "tracky-sweep-emails";
const DEFAULT_CRON = "*/15 * * * *";

async function main() {
  const command = process.argv[2] ?? "setup";

  const token = required("QSTASH_TOKEN");
  const client = new Client({ token });

  if (command === "list") return list(client);
  if (command === "remove") return remove(client);
  if (command !== "setup") {
    throw new Error(`Unknown command "${command}". Use setup, list or remove.`);
  }

  const appUrl = required("APP_URL").replace(/\/$/, "");
  const cronSecret = required("CRON_SECRET");
  const cron = process.env.QSTASH_SWEEP_CRON?.trim() || DEFAULT_CRON;

  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    throw new Error(
      `APP_URL is ${appUrl}. QStash calls your app over the internet, so this ` +
        "must be a public URL. Set APP_URL to your deployment and re-run.",
    );
  }

  const destination = `${appUrl}/api/cron/sweep-emails`;

  const { scheduleId } = await client.schedules.create({
    scheduleId: SCHEDULE_ID,
    destination,
    cron,
    method: "POST",
    // The route accepts a QStash signature on its own. The bearer token is
    // sent as well so the schedule keeps working if the signing keys are
    // rotated before the deployment picks them up.
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ source: "qstash-schedule" }),
    retries: 3,
  });

  console.log(`✓ schedule ${scheduleId}`);
  console.log(`  cron        ${cron}`);
  console.log(`  destination ${destination}`);
  console.log(
    "\nVercel Cron still runs the same endpoint once a day as a backstop.",
  );
}

async function list(client: Client) {
  const schedules = await client.schedules.list();

  if (schedules.length === 0) {
    console.log("No QStash schedules. Run `npm run qstash:setup`.");
    return;
  }

  for (const schedule of schedules) {
    console.log(`${mark(schedule)} ${schedule.scheduleId}`);
    console.log(`  cron        ${schedule.cron}`);
    console.log(`  destination ${schedule.destination}`);
  }
}

async function remove(client: Client) {
  await client.schedules.delete(SCHEDULE_ID);
  console.log(`✓ deleted ${SCHEDULE_ID}`);
  console.log(
    "The daily Vercel Cron run is now the only sweep. Delayed email still " +
      "goes out on time via QStash messages; only the safety net is slower.",
  );
}

function mark(schedule: Schedule): string {
  return schedule.isPaused ? "‖" : "✓";
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
