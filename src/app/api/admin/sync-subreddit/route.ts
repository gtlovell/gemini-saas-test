import { NextResponse } from "next/server";
import { syncSubredditMetadata } from "@/src/lib/tasks/syncSubredditMetadata";

export async function GET(request: Request) {
  // Basic security: In a real app, protect this route (e.g., check for admin user)
  // For now, allow in development environment only for testing.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subredditName = searchParams.get("name");

  if (!subredditName) {
    return NextResponse.json(
      { error: 'Missing subreddit name parameter "name"' },
      { status: 400 }
    );
  }

  try {
    console.log(`API request to sync r/${subredditName}`);
    const result = await syncSubredditMetadata(subredditName);

    if (result) {
      return NextResponse.json({ success: true, data: result });
    } else {
      // This might happen if Reddit API returned null (e.g., 404)
      return NextResponse.json(
        {
          success: false,
          message: `Could not sync r/${subredditName}, may not exist on Reddit.`,
        },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error(`API Error syncing r/${subredditName}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Add `export const dynamic = 'force-dynamic'` if needed
export const dynamic = "force-dynamic";
