import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/service";
import { syncSubredditMetadata } from "@/src/lib/tasks/syncSubredditMetadata";
import { sleep } from "@/src/lib/utils";

function verifyCronSecret(request: Request): boolean {
  const providedSecret = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "");
  return providedSecret === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.warn("[Cron Sync Metadata] Invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Sync Metadata] Job starting...");
  const supabase = createClient();
  let subredditsProcessed = 0;

  try {
    const { data: trackedSubreddits, error: fetchError } = await supabase
      .from("subreddits")
      .select("name")
      .eq("is_tracked", true); // Or maybe sync all known subs? Decide scope.

    if (fetchError) throw fetchError;
    if (!trackedSubreddits || trackedSubreddits.length === 0) {
      console.log("[Cron Sync Metadata] No tracked subreddits found.");
      return NextResponse.json({ message: "No tracked subreddits found." });
    }

    console.log(
      `[Cron Sync Metadata] Found ${trackedSubreddits.length} subreddits to update metadata for.`
    );

    for (const sub of trackedSubreddits) {
      try {
        console.log(
          `[Cron Sync Metadata] Syncing metadata for r/${sub.name}...`
        );
        await syncSubredditMetadata(sub.name); // This handles its own caching logic
        subredditsProcessed++;
        await sleep(1000); // 1 second delay
      } catch (syncError: any) {
        console.error(
          `[Cron Sync Metadata] Failed to sync metadata for r/${sub.name}:`,
          syncError.message
        );
      }
    }

    const message = `[Cron Sync Metadata] Job finished. Processed ${subredditsProcessed}/${trackedSubreddits.length} subreddits.`;
    console.log(message);
    return NextResponse.json({ message });
  } catch (error: any) {
    console.error("[Cron Sync Metadata] Job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
