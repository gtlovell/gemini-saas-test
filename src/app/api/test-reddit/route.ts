import { NextResponse } from "next/server";
import { fetchSubredditInfo } from "@/src/lib/reddit";

export async function GET() {
  // Ensure this route is protected or only used for testing purposes
  // Add authentication checks if needed

  const subredditName = "nextjs"; // Example subreddit
  try {
    console.log(`Fetching info for r/${subredditName}...`);
    const subredditData = await fetchSubredditInfo(subredditName);

    if (subredditData) {
      console.log(`Successfully fetched data for r/${subredditName}`);
      // We only send back a minimal part, don't expose the whole object usually
      return NextResponse.json({
        name: subredditData.display_name,
        title: subredditData.title,
        subscribers: subredditData.subscribers,
      });
    } else {
      console.log(
        `Could not fetch data for r/${subredditName} (likely 404 or API error).`
      );
      return NextResponse.json(
        { error: `Could not fetch data for r/${subredditName}` },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("Error in /api/test-reddit:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

// Add `export const dynamic = 'force-dynamic'` if needed, especially in Vercel edge/serverless
export const dynamic = "force-dynamic";
