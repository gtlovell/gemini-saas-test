import Snoowrap from "snoowrap";

// Ensure environment variables are loaded (important for server-side code)
const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  REDDIT_PASSWORD,
  REDDIT_USER_AGENT,
} = process.env;

let snoowrapInstance: Snoowrap | null = null;

export function getRedditClient(): Snoowrap {
  if (
    !REDDIT_CLIENT_ID ||
    !REDDIT_CLIENT_SECRET ||
    !REDDIT_USERNAME ||
    !REDDIT_PASSWORD ||
    !REDDIT_USER_AGENT
  ) {
    throw new Error("Missing Reddit API credentials in environment variables.");
  }

  // Use singleton pattern to avoid re-creating the client unnecessarily
  if (!snoowrapInstance) {
    console.log("Initializing Snoowrap client..."); // Add logging for debugging
    snoowrapInstance = new Snoowrap({
      userAgent: REDDIT_USER_AGENT,
      clientId: REDDIT_CLIENT_ID,
      clientSecret: REDDIT_CLIENT_SECRET,
      username: REDDIT_USERNAME,
      password: REDDIT_PASSWORD,
    });

    // Optional: Configure retry delays if needed (snoowrap has defaults)
    // snoowrapInstance.config({ retryDelay: 5000 }); // Example: Wait 5s before retrying

    console.log("Snoowrap client initialized.");
  }

  return snoowrapInstance;
}

// Example basic error handling wrapper (can be expanded)
export async function safeRedditAPICall<T>(
  apiCall: () => Promise<T>
): Promise<T | null> {
  try {
    // TODO: Implement more sophisticated rate limit checks here before calling
    // Check snoowrapInstance.ratelimitRemaining, snoowrapInstance.ratelimitExpiration
    const result = await apiCall();
    // Log remaining rate limit?
    // console.log(`Reddit API Rate Limit Remaining: ${snoowrapInstance?.ratelimitRemaining}`);
    return result;
  } catch (error: any) {
    console.error("Reddit API Error:", error.message);
    // Handle specific error types (rate limiting, 404, 403, etc.)
    if (error.statusCode === 429) {
      console.warn("Reddit Rate Limit Hit. Need to wait.");
      // Implement waiting logic or re-queueing if necessary
    } else if (error.statusCode === 404) {
      console.warn("Reddit resource not found (404).");
      return null; // Often acceptable to return null for 404s
    } else if (error.statusCode === 403) {
      console.error(
        "Reddit API Forbidden (403). Check credentials or permissions."
      );
      // Potentially throw a more specific error or handle differently
    }
    // Log the full error for detailed debugging if needed
    // console.error(error);

    // Depending on the error, you might want to return null, throw, or retry
    return null; // Default to returning null on error for now
  }
}

// Example Usage (demonstrates fetching subreddit info)
export async function fetchSubredditInfo(subredditName: string) {
  const r = getRedditClient();
  return safeRedditAPICall(() => r.getSubreddit(subredditName).fetch());
}
