import { syncSubredditPosts, DbPost } from "./syncSubredditPosts";
import type { ListingType } from "./syncSubredditPosts"; // Import if needed, or redefine
import type { TimeFrame } from "./syncSubredditPosts"; // Import if needed, or redefine

// Define reasonable defaults and constraints
const DEFAULT_PAGE_LIMIT = 2; // How many pages to fetch per backfill call by default
const MAX_ALLOWED_PAGES = 20; // Safety limit: Max pages to fetch in one go (100 posts/page * 20 = 2000 posts)
const DELAY_BETWEEN_PAGES_MS = 2000; // Delay (in ms) between Reddit API calls for pages (be kind!)

interface BackfillResult {
  subredditName: string;
  listingType: ListingType;
  timeFrame?: TimeFrame;
  pagesFetched: number;
  postsProcessed: number;
  status: "completed" | "limit_reached" | "error" | "no_subreddit";
  message: string;
}

/**
 * Fetches multiple pages of posts for a subreddit historically.
 * Primarily designed for 'top' listings with timeframes.
 *
 * @param subredditName The name of the subreddit.
 * @param listingType Listing type ('top' recommended for backfill).
 * @param options Control parameters:
 *  - timeFrame: Required for 'top' listing ('all', 'year', 'month', etc.).
 *  - maxPages: How many pages to attempt fetching (default: DEFAULT_PAGE_LIMIT, max: MAX_ALLOWED_PAGES).
 *  - initialAfter: Start pagination after this specific post fullname (e.g., t3_xxxxx).
 * @returns BackfillResult object summarizing the operation.
 */
export async function backfillSubredditPosts(
  subredditName: string,
  listingType: ListingType = "top",
  options: {
    timeFrame?: TimeFrame;
    maxPages?: number;
    initialAfter?: string | null;
  } = {}
): Promise<BackfillResult> {
  const lowerCaseName = subredditName.toLowerCase();
  const { timeFrame, initialAfter = null } = options;
  const maxPages = Math.min(
    options.maxPages ?? DEFAULT_PAGE_LIMIT,
    MAX_ALLOWED_PAGES
  );

  if (listingType === "top" && !timeFrame) {
    return {
      subredditName: lowerCaseName,
      listingType,
      pagesFetched: 0,
      postsProcessed: 0,
      status: "error",
      message:
        'Error: Timeframe is required for "top" listing type during backfill.',
    };
  }

  let after: string | null = initialAfter;
  let totalPostsProcessed = 0;
  let pagesFetched = 0;
  let shouldContinue = true;

  console.log(
    `[backfillSubredditPosts] Starting backfill for r/${lowerCaseName} ` +
      `(type: ${listingType}, time: ${
        timeFrame || "N/A"
      }, maxPages: ${maxPages}, startAfter: ${after ?? "none"})`
  );

  try {
    do {
      console.log(
        `[backfillSubredditPosts] Fetching page ${pagesFetched + 1} (after: ${
          after ?? "start"
        })`
      );

      // Prepare options for the single page sync
      const syncOptions: {
        limit?: number;
        after?: string | null;
        time?: TimeFrame;
      } = {
        // syncSubredditPosts uses default limit (e.g., 50 or 100), we control pages here
        after: after,
        time: timeFrame,
      };

      const batchResult: DbPost[] | null = await syncSubredditPosts(
        lowerCaseName,
        listingType,
        syncOptions
      );

      if (batchResult === null) {
        // This indicates syncSubredditPosts failed, likely due to subreddit sync issue
        console.warn(
          `[backfillSubredditPosts] syncSubredditPosts returned null for r/${lowerCaseName}. Subreddit likely doesn't exist or failed sync.`
        );
        shouldContinue = false;
        return {
          subredditName: lowerCaseName,
          listingType,
          timeFrame,
          pagesFetched,
          postsProcessed: totalPostsProcessed,
          status: "no_subreddit",
          message: `Failed to sync subreddit r/${lowerCaseName}. Aborting backfill.`,
        };
      }

      if (batchResult.length === 0) {
        // No more posts returned by Reddit for this query
        console.log(
          `[backfillSubredditPosts] Reached end of listing for r/${lowerCaseName}.`
        );
        shouldContinue = false;
        break;
      }

      totalPostsProcessed += batchResult.length;
      pagesFetched++;

      // Get the 'name' (fullname, e.g., t3_xxxxx) of the last post for the next 'after'
      // Snoowrap results might be Listing<Submission>, need to access raw object name. Find correct way.
      // Let's assume our DbPost stores reddit_id correctly as 't3_...' or just the ID part. Adjust if needed.
      // If DbPost.reddit_id stores only 'abcde', prefix with 't3_'. If it stores 't3_abcde', use directly.
      // Assuming reddit_id in DbPost is the ID part *without* the 't3_' prefix based on previous sync code:
      const lastPostRedditId = batchResult[batchResult.length - 1]?.reddit_id;
      after = lastPostRedditId ? `t3_${lastPostRedditId}` : null;

      console.log(
        `[backfillSubredditPosts] Page ${pagesFetched} fetched, ${batchResult.length} posts processed. Total: ${totalPostsProcessed}. Next 'after': ${after}`
      );

      // Check if we've reached the page limit
      if (pagesFetched >= maxPages) {
        console.log(
          `[backfillSubredditPosts] Reached max pages limit (${maxPages}).`
        );
        shouldContinue = false;
        return {
          subredditName: lowerCaseName,
          listingType,
          timeFrame,
          pagesFetched,
          postsProcessed: totalPostsProcessed,
          status: "limit_reached",
          message: `Completed backfill after reaching page limit (${maxPages}).`,
        };
      }

      // Check if we should continue and add delay if more pages are expected
      if (shouldContinue && after) {
        console.log(
          `[backfillSubredditPosts] Waiting ${DELAY_BETWEEN_PAGES_MS}ms before next page...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_PAGES_MS)
        );
      } else {
        // If 'after' is null, we've reached the end unexpectedly? Or last batch was empty.
        shouldContinue = false;
      }
    } while (shouldContinue && after); // Continue if we should and have a token for the next page

    console.log(
      `[backfillSubredditPosts] Finished backfill for r/${lowerCaseName}. Total pages: ${pagesFetched}, Total posts: ${totalPostsProcessed}.`
    );
    return {
      subredditName: lowerCaseName,
      listingType,
      timeFrame,
      pagesFetched,
      postsProcessed: totalPostsProcessed,
      status: "completed",
      message: `Successfully completed backfill. Fetched ${pagesFetched} pages.`,
    };
  } catch (error: any) {
    console.error(
      `[backfillSubredditPosts] Critical error during backfill for r/${lowerCaseName}:`,
      error
    );
    return {
      subredditName: lowerCaseName,
      listingType,
      timeFrame,
      pagesFetched,
      postsProcessed: totalPostsProcessed,
      status: "error",
      message: `An error occurred during backfill: ${error.message}`,
    };
  }
}
