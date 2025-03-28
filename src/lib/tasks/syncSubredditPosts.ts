import supabaseServiceRole from "@/src/lib/supabase/service"; // Import the initialized client instance
import { getRedditClient, safeRedditAPICall } from "@/src/lib/reddit";
import { syncSubredditMetadata, DbSubreddit } from "./syncSubredditMetadata"; // Reuse to ensure subreddit exists
import type { Listing, Submission } from "snoowrap";
import { PostgrestError } from "@supabase/supabase-js";

// Define an interface for our database post record
export interface DbPost {
  id: string; // Our internal UUID
  created_at: string;
  updated_at: string;
  reddit_id: string; // Reddit's post ID (e.g., 't3_xxxxx')
  subreddit_id: string; // FK to our subreddits table
  author_reddit_id: string | null; // Reddit's author ID (e.g., 't2_xxxxx')
  author_name: string | null;
  title: string | null;
  body: string | null; // selftext
  url: string | null; // URL if it's a link post
  permalink: string | null; // Relative URL on Reddit
  score: number;
  upvote_ratio: number | null;
  num_comments: number;
  created_utc: string; // ISO timestamp
  last_scraped_at: string | null;
  flair_text: string | null;
  is_self: boolean;
  is_video: boolean;
  is_oc: boolean;
  is_over_18: boolean;
}

// Type for the data we map from Snoowrap to upsert
type PostUpsertData = Omit<DbPost, "id" | "created_at" | "updated_at">;

const POST_LISTING_LIMIT = 50; // Max posts to fetch per Reddit API call (max 100 allowed by Reddit)

/**
 * Fetches a listing of posts (hot, new, top) for a subreddit and upserts them into the DB.
 *
 * @param subredditName The name of the subreddit.
 * @param listingType The type of listing ('hot', 'new', 'top', 'controversial'). Defaults to 'hot'.
 * @param options Snoowrap options (e.g., { limit, after, before, time: 'day' }). Defaults to limit=50.
 * @returns The list of upserted posts from the database or null if subreddit sync failed.
 * @throws Error on critical API or DB failures.
 */
export async function syncSubredditPosts(
  subredditName: string,
  listingType: "hot" | "new" | "top" | "controversial" = "hot",
  options: {
    limit?: number;
    after?: string | null;
    time?: "hour" | "day" | "week" | "month" | "year" | "all";
  } = {}
): Promise<DbPost[] | null> {
  const supabase = supabaseServiceRole; // Use the imported instance directly
  const r = getRedditClient(); // Snoowrap client
  const effectiveLimit = options.limit ?? POST_LISTING_LIMIT;
  const lowerCaseName = subredditName.toLowerCase();

  console.log(
    `[syncSubredditPosts] Starting sync for r/${lowerCaseName} - ${listingType} listing (limit: ${effectiveLimit}, after: ${
      options.after ?? "N/A"
    })`
  );

  // 1. Ensure Subreddit exists in our DB and get its ID
  let dbSubreddit: DbSubreddit | null;
  try {
    // We call syncSubredditMetadata to ensure the subreddit record is present and reasonably fresh.
    // It handles its own caching. If it returns null, the subreddit likely doesn't exist on Reddit.
    dbSubreddit = await syncSubredditMetadata(lowerCaseName);
    if (!dbSubreddit) {
      console.warn(
        `[syncSubredditPosts] Subreddit r/${lowerCaseName} could not be synced or found. Aborting post sync.`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[syncSubredditPosts] Error ensuring subreddit r/${lowerCaseName} exists:`,
      error
    );
    throw error; // Re-throw critical error
  }

  const subredditId = dbSubreddit.id;

  // 2. Fetch Posts from Reddit API
  let redditPosts: Listing<Submission> | null = null;
  const fetchOptions = {
    limit: effectiveLimit,
    after: options.after ?? undefined, // Ensure 'after' is string or undefined, not null
    time: options.time,
  };

  try {
    const apiCall = () => {
      const sub = r.getSubreddit(lowerCaseName);
      switch (listingType) {
        case "new":
          return sub.getNew(fetchOptions);
        case "top":
          return sub.getTop(fetchOptions);
        case "controversial":
          return sub.getControversial(fetchOptions);
        case "hot":
        default:
          return sub.getHot(fetchOptions);
      }
    };
    // Use safeRedditAPICall to wrap the specific snoowrap method
    redditPosts = await safeRedditAPICall(apiCall);
  } catch (error) {
    console.error(
      `[syncSubredditPosts] Critical error fetching posts for r/${lowerCaseName} from Reddit:`,
      error
    );
    throw new Error(
      `Failed to fetch posts from Reddit: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  if (!redditPosts || redditPosts.length === 0) {
    console.warn(
      `[syncSubredditPosts] Reddit API returned no posts for r/${lowerCaseName} (listing: ${listingType}).`
    );
    // This isn't necessarily an error, could be an empty subreddit or end of pagination
    return []; // Return empty array, indicating no posts were processed
  }

  console.log(
    `[syncSubredditPosts] Fetched ${redditPosts.length} posts from Reddit for r/${lowerCaseName}.`
  );

  // 3. Map Reddit Posts to DB Schema
  const postsToUpsert: PostUpsertData[] = redditPosts.map(
    (post: Submission): PostUpsertData => {
      const isAuthorDeleted = post.author?.name === "[deleted]";
      return {
        reddit_id: post.id, // Reddit's internal ID prefixed with t3_
        subreddit_id: subredditId,
        author_reddit_id: isAuthorDeleted ? null : post.author?.id || null,
        author_name: isAuthorDeleted ? "[deleted]" : post.author?.name || null, // Keep '[deleted]' for name if applicable
        title: post.title,
        body: post.selftext || null,
        url: post.url || null,
        permalink: post.permalink || null,
        score: post.score ?? 0,
        upvote_ratio: post.upvote_ratio ?? null,
        num_comments: post.num_comments ?? 0,
        created_utc: new Date(post.created_utc * 1000).toISOString(),
        last_scraped_at: new Date().toISOString(), // Mark as scraped now
        flair_text: post.link_flair_text || null,
        is_self: post.is_self ?? false,
        is_video: post.is_video ?? false,
        is_oc: post.is_original_content ?? false,
        is_over_18: post.over_18 ?? false,
      };
    }
  );

  // 4. Upsert Posts into Supabase
  console.log(
    `[syncSubredditPosts] Upserting ${postsToUpsert.length} posts for r/${lowerCaseName} into Supabase.`
  );
  const {
    data: upsertedPosts,
    error: upsertError,
  }: { data: DbPost[] | null; error: PostgrestError | null } = await supabase
    .from("posts")
    .upsert(postsToUpsert, {
      onConflict: "reddit_id", // Use Reddit's unique ID to handle conflicts
      ignoreDuplicates: false, // Ensure existing rows are updated
    })
    .select(); // Return the upserted rows

  if (upsertError) {
    console.error(
      `[syncSubredditPosts] Error upserting posts for r/${lowerCaseName}:`,
      upsertError
    );
    throw new Error(`Supabase upsert error: ${upsertError.message}`);
  }

  if (!upsertedPosts) {
    console.warn(
      `[syncSubredditPosts] Upsert for r/${lowerCaseName} posts did not return data, though no error reported.`
    );
    return []; // Return empty array if upsert completes but returns nothing unexpected
  }

  console.log(
    `[syncSubredditPosts] Successfully upserted ${upsertedPosts.length} posts for r/${lowerCaseName}.`
  );

  // TODO: Consider pagination - The 'redditPosts' object might have a fetchMore() method,
  // or we can use the 'after' property (redditPosts[redditPosts.length - 1]?.name)
  // to make subsequent calls to syncSubredditPosts. This needs a controlling loop/mechanism.

  return upsertedPosts;
}
