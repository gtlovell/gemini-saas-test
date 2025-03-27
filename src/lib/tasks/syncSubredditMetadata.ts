import { createClient } from "@/src/lib/supabase/server";
import supabaseServiceRole from "@/src/lib/supabase/service";
import { fetchSubredditInfo } from "@/src/lib/reddit";
import type { Subreddit as SnoowrapSubreddit } from "snoowrap";
import { PostgrestSingleResponse } from "@supabase/supabase-js";

// Interface for our DB record
export interface DbSubreddit {
  id: string;
  created_at: string;
  updated_at: string;
  reddit_id: string;
  name: string;
  title: string | null;
  description: string | null;
  subscribers: number | null;
  active_users: number | null;
  icon_url: string | null;
  banner_url: string | null;
  created_utc: string | null;
  last_scraped_at: string | null; // <-- The crucial timestamp for caching
  is_tracked: boolean;
}

// --- Cache Configuration ---
const SUBREDDIT_METADATA_STALE_MINUTES = 60; // Stale after 1 hour
// --------------------------

export async function syncSubredditMetadata(
  subredditName: string
): Promise<DbSubreddit | null> {
  const supabase = supabaseServiceRole;
  const lowerCaseName = subredditName.toLowerCase();

  console.log(`[Sync] Starting sync for r/${lowerCaseName}`);

  // --- ADD THESE DEBUG LINES ---
  console.log(
    `[Sync Debug] Supabase URL read from env: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`
  );
  console.log(
    `[Sync Debug] Service Key loaded status: ${!!process.env
      .SUPABASE_SERVICE_ROLE_KEY}`
  ); // Don't log the key itself!
  // ----------------------------

  // 1. Check Cache (Supabase DB)
  const {
    data: existingSubreddit,
    error: fetchError,
  }: PostgrestSingleResponse<DbSubreddit> = await supabase
    .from("subreddits")
    .select("*")
    .eq("name", lowerCaseName)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `[Sync] Error fetching r/${lowerCaseName} from DB:`,
      fetchError
    );
    throw new Error(`Supabase fetch error: ${fetchError.message}`);
  }

  // --- Caching Logic ---
  if (existingSubreddit) {
    console.log(`[Sync] Found cached data for r/${lowerCaseName}.`);
    const lastScraped = existingSubreddit.last_scraped_at
      ? new Date(existingSubreddit.last_scraped_at)
      : null;
    // Calculate the time threshold for staleness
    const staleThreshold = new Date(
      Date.now() - SUBREDDIT_METADATA_STALE_MINUTES * 60 * 1000
    );

    // If lastScraped exists AND it's more recent than the threshold, return cached data
    if (lastScraped && lastScraped > staleThreshold) {
      console.log(`[Sync] Cache hit for r/${lowerCaseName}. Data is fresh.`);
      return existingSubreddit; // <<<=== CACHE HIT: RETURN DB DATA
    } else {
      console.log(
        `[Sync] Cache for r/${lowerCaseName} is stale or missing scrape time. Will fetch from Reddit.`
      );
    }
  } else {
    console.log(
      `[Sync] No cache found for r/${lowerCaseName}. Will fetch from Reddit.`
    );
  }
  // --- End Caching Logic ---

  // 2. Fetch from Reddit API (Cache Miss or Stale)
  console.log(`[Sync] Fetching r/${lowerCaseName} from Reddit API...`);
  let redditData: SnoowrapSubreddit | null = null;
  try {
    redditData = await fetchSubredditInfo(lowerCaseName);
  } catch (error) {
    console.error(
      `[Sync] Critical error fetching r/${lowerCaseName} from Reddit:`,
      error
    );
    throw new Error(
      `Failed to fetch subreddit info from Reddit: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  if (!redditData) {
    console.warn(`[Sync] Reddit API returned no data for r/${lowerCaseName}.`);
    // Return stale data if available, otherwise null. Prevents deleting valid cache on transient API errors.
    return existingSubreddit ?? null;
  }

  console.log(
    `[Sync] Successfully fetched data for r/${lowerCaseName} from Reddit.`
  );

  // 3. Map Reddit Data
  const subredditDataToUpsert = {
    reddit_id: redditData.id,
    name: redditData.display_name.toLowerCase(),
    title: redditData.title || null,
    description: redditData.public_description || null,
    subscribers: redditData.subscribers || 0,
    active_users: redditData.accounts_active || 0,
    icon_url: redditData.icon_img || redditData.community_icon || null,
    banner_url:
      redditData.banner_background_image || redditData.banner_img || null,
    created_utc: redditData.created_utc
      ? new Date(redditData.created_utc * 1000).toISOString()
      : null,
    last_scraped_at: new Date().toISOString(), // <<<=== UPDATE CACHE TIMESTAMP
    // is_tracked is managed elsewhere
  };

  // 4. Upsert into Supabase (Update Cache)
  console.log(`[Sync] Upserting data for r/${lowerCaseName} into Supabase.`);
  const {
    data: upsertedSubreddit,
    error: upsertError,
  }: PostgrestSingleResponse<DbSubreddit> = await supabase
    .from("subreddits")
    .upsert(subredditDataToUpsert, { onConflict: "name" })
    .select()
    .single();

  if (upsertError) {
    console.error(
      `[Sync] Error upserting r/${lowerCaseName} into DB:`,
      upsertError
    );
    // Consider returning stale data on upsert failure?
    throw new Error(`Supabase upsert error: ${upsertError.message}`);
  }

  if (!upsertedSubreddit) {
    console.error(`[Sync] Upsert for r/${lowerCaseName} did not return data.`);
    throw new Error("Supabase upsert failed to return data.");
  }

  console.log(`[Sync] Successfully synced and cached r/${lowerCaseName}.`);
  return upsertedSubreddit; // <<<=== RETURN NEWLY FETCHED/CACHED DATA
}
