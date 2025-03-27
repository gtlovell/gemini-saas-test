import { syncSubredditPosts, DbPost } from "./syncSubredditPosts";
import { sleep } from "@/lib/utils"; // Simple utility for delays

const DEFAULT_BACKFILL_BATCH_SIZE = 50; // Posts per Reddit API request
const DEFAULT_DELAY_BETWEEN_BATCHES_MS = 2000; // 2 seconds delay
const MAX_BACKFILL_POSTS_SAFETY_LIMIT = 1000; // Safety break to prevent infinite loops/costs

/**
 * Orchestrates the backfilling of historical posts for a subreddit using pagination.
 *
 * @param subredditName The name of the subreddit to backfill.
 * @param options Control parameters for the backfill process.
 * @param options.listingType The listing type to fetch ('top', 'new', etc.). Defaults to 'top'.
 * @param options.timeframe The time frame for 'top' or 'controversial' listings ('all', 'year', 'month', etc.). Defaults to 'all'.
 * @param options.maxPostsToFetch The target number of posts to try and fetch. Defaults to MAX_BACKFILL_POSTS_SAFETY_LIMIT.
 * @param options.batchSize The number of posts to fetch per API call. Defaults to DEFAULT_BACKFILL_BATCH_SIZE.
 * @param options.delayMs Delay between batches in milliseconds. Defaults to DEFAULT_DELAY_BETWEEN_BATCHES_MS.
 * @returns A summary of the backfill operation.
 */
export async function backfillSubredditHistory(
  subredditName: string,
  options: {
    listingType?: "top" | "new" | "controversial";
    timeframe?: "all" | "year" | "month" | "week" | "day" | "hour";
    maxPostsToFetch?: number;
    batchSize?: number;
    delayMs?: number;
  } = {}
): Promise<{
  success: boolean;
  subreddit: string;
  postsProcessed: number;
  pagesFetched: number;
  message: string;
}> {
  const {
    listingType = "top",
    timeframe = "all",
    maxPostsToFetch = MAX_BACKFILL_POSTS_SAFETY_LIMIT,
    batchSize = DEFAULT_BACKFILL_BATCH_SIZE,
    delayMs = DEFAULT_DELAY_BETWEEN_BATCHES_MS,
  } = options;

  let after: string | null = null; // Stores the 'after' cursor for pagination
  let totalPostsProcessed = 0;
  let pagesFetched = 0;
  const lowerCaseName = subredditName.toLowerCase();

  console.log(
    `[Backfill] Starting for r/${lowerCaseName}. Type: ${listingType}, Timeframe: ${timeframe}, Target: ${maxPostsToFetch} posts.`
  );

  try {
    do {
      console.log(
        `[Backfill] Fetching page ${
          pagesFetched + 1
        } for r/${lowerCaseName} (after: ${after ?? "start"})...`
      );

      const batch = await syncSubredditPosts(lowerCaseName, listingType, {
        limit: batchSize,
        after: after,
        time:
          listingType === "top" || listingType === "controversial"
            ? timeframe
            : undefined,
      });

      if (batch === null) {
        // This indicates syncSubredditPosts failed critically before/during API call (e.g., subreddit sync failed)
        throw new Error(
          `syncSubredditPosts returned null, possibly failed to sync subreddit r/${lowerCaseName}.`
        );
      }

      const batchSizeProcessed = batch.length;
      totalPostsProcessed += batchSizeProcessed;
      pagesFetched++;

      console.log(
        `[Backfill] Processed batch of ${batchSizeProcessed} posts for r/${lowerCaseName}. Total: ${totalPostsProcessed}`
      );

      if (batchSizeProcessed === 0) {
        console.log(
          `[Backfill] Received 0 posts for r/${lowerCaseName}. Assuming end of listing.`
        );
        break; // Exit loop if no posts are returned
      }

      // Get the 'name' (fullname, e.g., t3_xxxxx) of the last post in the batch
      // This requires the full post object potentially, let's refine syncSubredditPosts if needed
      // Assuming syncSubredditPosts returns DbPost which includes reddit_id (like 'abc12')
      // The 'name' is usually 't<type>_<id>', e.g. 't3_abc12' for a post
      const lastPostRedditId = batch[batch.length - 1]?.reddit_id;
      after = lastPostRedditId ? `t3_${lastPostRedditId}` : null; // Construct the 'fullname' for the 'after' param

      if (!after) {
        console.log(
          `[Backfill] Could not determine 'after' cursor from last post. Stopping.`
        );
        break;
      }

      if (totalPostsProcessed >= maxPostsToFetch) {
        console.log(
          `[Backfill] Reached target post count (${totalPostsProcessed}/${maxPostsToFetch}). Stopping.`
        );
        break;
      }

      // Crucial: Wait before the next API call
      console.log(`[Backfill] Waiting ${delayMs}ms before next batch...`);
      await sleep(delayMs);
    } while (true); // Loop continues until explicitly broken

    const message = `Successfully completed backfill for r/${lowerCaseName}. Processed ${totalPostsProcessed} posts over ${pagesFetched} pages.`;
    console.log(`[Backfill] ${message}`);
    return {
      success: true,
      subreddit: lowerCaseName,
      postsProcessed: totalPostsProcessed,
      pagesFetched,
      message,
    };
  } catch (error: any) {
    const message = `Error during backfill for r/${lowerCaseName} after ${pagesFetched} pages, ${totalPostsProcessed} posts: ${error.message}`;
    console.error(`[Backfill] ${message}`, error);
    return {
      success: false,
      subreddit: lowerCaseName,
      postsProcessed: totalPostsProcessed,
      pagesFetched,
      message,
    };
  }
}

// Helper function for delays (if not already in a utils file)
// Create src/lib/utils.ts if it doesn't exist
// export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
