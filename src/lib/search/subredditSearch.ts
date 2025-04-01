import { createClient as createServerClient } from "@/src/lib/supabase/server"; // Use server client if user context needed for filtering later
import { createClient as createServiceRoleClient } from "@/src/lib/supabase/service"; // Or service role if always public search
import { DbSubreddit } from "@/src/lib/tasks/syncSubredditMetadata"; // Reuse type

// Define search result type potentially adding rank
export interface SubredditSearchResult extends DbSubreddit {
  rank?: number; // Optional rank from FTS
}

interface SearchOptions {
  query: string;
  categoryIds?: string[]; // Array of UUIDs for filtering
  limit?: number;
  offset?: number;
  sortBy?: "rank" | "subscribers" | "created_at" | "name"; // Add more as needed
  ascending?: boolean;
}

const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Searches for subreddits using PostgreSQL Full-Text Search and optional category filters.
 *
 * @param options SearchOptions object containing query, filters, and pagination.
 * @returns Promise<SubredditSearchResult[]> Array of matching subreddits.
 */
export async function searchSubreddits(
  options: SearchOptions
): Promise<SubredditSearchResult[]> {
  // Decide which client to use. If search results depend on the user
  // (e.g., filtering by user-tracked status), use server client.
  // If search is always public, service role might be simpler/faster.
  // Let's assume public search for now, using service role.
  const supabase = createServiceRoleClient(); // Or createServerClient() if user context needed

  const {
    query,
    categoryIds,
    limit = DEFAULT_SEARCH_LIMIT,
    offset = 0,
    sortBy = "rank", // Default sort by relevance
    ascending = false, // Default descending (highest rank/subscribers first)
  } = options;

  // Basic input validation
  if (!query || query.trim().length < 2) {
    // Avoid searching on empty or very short strings
    return [];
  }
  if (limit <= 0 || limit > 100) {
    throw new Error("Limit must be between 1 and 100.");
  }
  if (offset < 0) {
    throw new Error("Offset must be non-negative.");
  }

  // --- Build the Query ---
  // Use plainto_tsquery for simpler user input handling (ANDs terms)
  // Use websearch_to_tsquery for more Google-like syntax (handles quotes, OR, -) - might be better UX
  const ftsQuery = `websearch_to_tsquery('simple', '${query.replace(
    /'/g,
    "''"
  )}')`; // Escape single quotes

  let supabaseQuery = supabase
    .from("subreddits")
    .select(
      `
            *,
            ts_rank(fts, ${ftsQuery}) as rank
        `
    )
    .order("is_tracked", { ascending: false }) // Show tracked ones first regardless of rank? Optional.
    .order(sortBy === "rank" ? "rank" : sortBy, { ascending: ascending })
    .limit(limit)
    .offset(offset);

  // Add FTS filter - @@ is the match operator
  supabaseQuery = supabaseQuery.filter("fts", "@@", ftsQuery);

  // Add category filtering if categoryIds are provided
  if (categoryIds && categoryIds.length > 0) {
    // We need to join with subreddit_categories
    // This might be easier with an RPC function or view if it gets complex
    // For now, let's filter based on an exact match (sub must have ALL specified categories)
    // Or more likely, ANY of the specified categories. Let's do ANY.

    // Note: Direct Supabase client join syntax can be tricky.
    // Using an RPC function is often cleaner for joins + FTS.
    // Let's attempt a filter using exists on the join table for now:

    // This part is complex with standard client, consider RPC:
    // supabaseQuery = supabaseQuery.rpc('search_subreddits_with_categories', {
    //     query_text: query,
    //     category_ids_array: categoryIds,
    //     result_limit: limit,
    //     result_offset: offset
    // });

    // Alternative (might be less performant): Filter subreddits that have an entry in subreddit_categories matching the IDs
    // This requires modifying the query structure significantly, likely best done with an RPC.
    console.warn(
      "Category filtering with FTS requires an RPC function for optimal implementation. Skipping category filter for now."
    );

    // If NOT using RPC, a workaround is to fetch IDs first then filter, less ideal:
    // 1. Fetch subreddit IDs matching FTS.
    // 2. Fetch subreddit IDs matching categories from subreddit_categories.
    // 3. Intersect the IDs.
    // 4. Fetch full subreddit details for the final IDs. (Inefficient)
  }

  // --- Execute Query ---
  console.log(`Executing FTS query for: "${query}"`);
  const { data, error } = await supabaseQuery;

  if (error) {
    console.error("Error searching subreddits:", error);
    throw new Error(`Failed to search subreddits: ${error.message}`);
  }

  return data || [];
}

// **TODO:** Create a PostgreSQL RPC function `search_subreddits_with_categories`
//          to handle the join and filtering logic more efficiently within the database.
