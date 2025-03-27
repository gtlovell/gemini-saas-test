import {
  syncSubredditMetadata,
  DbSubreddit,
} from "@/src/lib/tasks/syncSubredditMetadata";

// --- Next.js Caching (Separate Layer) ---
// This controls how often Next.js re-runs this Server Component to fetch fresh data.
// It works WITH the Supabase cache logic. If Next.js revalidates, it calls
// syncSubredditMetadata, which THEN checks its own Supabase cache.
export const revalidate = 300; // Revalidate this page (run this component) every 5 minutes
// -----------------------------------------

interface SubredditPageProps {
  params: { name: string };
}

export default async function SubredditPage({ params }: SubredditPageProps) {
  const subredditName = params.name;
  let subredditData: DbSubreddit | null = null;
  let error: string | null = null;

  console.log(`[Page] Rendering page for r/${subredditName}`);

  try {
    // --- Using the Supabase Caching Function ---
    // This call handles fetching from DB, checking staleness,
    // calling Reddit API if needed, and updating DB.
    subredditData = await syncSubredditMetadata(subredditName);
    // -------------------------------------------
  } catch (err) {
    console.error(`[Page] Error loading data for r/${subredditName}:`, err);
    // Handle specific errors if needed, otherwise show generic message
    error =
      err instanceof Error ? err.message : "Failed to load subreddit data.";
  }

  // --- Render based on result ---
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!subredditData) {
    // This means syncSubredditMetadata returned null (e.g., 404 from Reddit)
    return (
      <div>
        Subreddit "r/{subredditName}" not found or could not be retrieved.
      </div>
    );
  }

  // --- Display the (potentially cached) data ---
  const lastCheckedDate = subredditData.last_scraped_at
    ? new Date(subredditData.last_scraped_at)
    : null;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">
        {subredditData.title || `r/${subredditData.name}`}
      </h1>
      <p className="text-gray-600">r/{subredditData.name}</p>

      <div className="mt-4 space-y-2">
        <p>
          <strong>Subscribers:</strong>{" "}
          {subredditData.subscribers?.toLocaleString() ?? "N/A"}
        </p>
        <p>
          <strong>Active Users:</strong>{" "}
          {subredditData.active_users?.toLocaleString() ?? "N/A"}
        </p>
        <p>
          <strong>Description:</strong>{" "}
          {subredditData.description || (
            <span className="italic text-gray-500">
              No description provided.
            </span>
          )}
        </p>
        {subredditData.icon_url && (
          <img
            src={subredditData.icon_url}
            alt="Icon"
            className="w-16 h-16 rounded-full my-2"
          />
        )}
        {/* Add more fields as needed */}
      </div>

      {lastCheckedDate && (
        <p className="text-sm text-gray-400 mt-4">
          Data last checked: {lastCheckedDate.toLocaleString()}
        </p>
      )}
    </div>
  );
}
