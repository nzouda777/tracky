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

/** Every schedule this script owns. */
const SCHEDULES = [
  {
    id: "tracky-sweep-emails",
    path: "/api/cron/sweep-emails",
    cronEnv: "QSTASH_SWEEP_CRON",
    defaultCron: "*/15 * * * *",
  },
  {
    // Moves orders on for stores that switched auto-advance on. Hourly, so an
    // order moves within the hour after its delay is up.
    id: "tracky-auto-advance",
    path: "/api/cron/auto-advance",
    cronEnv: "QSTASH_AUTO_ADVANCE_CRON",
    defaultCron: "0 * * * *",
  },
  {
    // Retries the Shopify fulfillment of new orders whose first push failed.
    id: "tracky-fulfillment-catch-up",
    path: "/api/cron/fulfillment-catch-up",
    cronEnv: "QSTASH_FULFILLMENT_CATCH_UP_CRON",
    defaultCron: "15 * * * *",
  },
] as const;

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

  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    throw new Error(
      `APP_URL is ${appUrl}. QStash calls your app over the internet, so this ` +
        "must be a public URL. Set APP_URL to your deployment and re-run.",
    );
  }

  for (const schedule of SCHEDULES) {
    const cron = process.env[schedule.cronEnv]?.trim() || schedule.defaultCron;
    const destination = `${appUrl}${schedule.path}`;

    const { scheduleId } = await client.schedules.create({
      scheduleId: schedule.id,
      destination,
      cron,
      method: "POST",
      // The routes accept a QStash signature on their own. The bearer token
      // is sent as well so the schedules keep working if the signing keys are
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
  }

  console.log(
    "\nVercel Cron still runs the same endpoints once a day as a backstop.",
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
  for (const schedule of SCHEDULES) {
    await client.schedules.delete(schedule.id);
    console.log(`✓ deleted ${schedule.id}`);
  }
  console.log(
    "The daily Vercel Cron runs are now the only ones. Delayed email still " +
      "goes out on time via QStash messages; the email safety net and " +
      "auto-advance only run once a day.",
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
