// src/app/api/admin/sync-posts/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { syncSubredditPosts } from "@/src/lib/tasks/syncSubredditPosts";
import type { DbPost } from "@/src/lib/tasks/syncSubredditPosts"; // Import the type if needed

// Define allowed listing types
type ListingType = "hot" | "new" | "top" | "controversial";
const ALLOWED_LISTING_TYPES: ListingType[] = [
  "hot",
  "new",
  "top",
  "controversial",
];

// Define allowed timeframes for 'top' and 'controversial'
type TimeFrame = "hour" | "day" | "week" | "month" | "year" | "all";
const ALLOWED_TIME_FRAMES: TimeFrame[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
  "all",
];

export async function GET(request: NextRequest) {
  // --- Basic Security ---
  // In a real app, protect this route more robustly (e.g., check for admin user role).
  // For now, restrict to development environment for testing.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Extract Query Parameters ---
  const { searchParams } = new URL(request.url);
  const subredditName = searchParams.get("name");
  const listingTypeParam = searchParams.get("type")?.toLowerCase();
  const limitParam = searchParams.get("limit");
  const afterParam = searchParams.get("after");
  const timeParam = searchParams.get("time")?.toLowerCase();

  // --- Validate Parameters ---
  if (!subredditName) {
    return NextResponse.json(
      { error: 'Missing required parameter: "name"' },
      { status: 400 }
    );
  }

  // Validate and set listing type, default to 'hot'
  let listingType: ListingType = "hot";
  if (
    listingTypeParam &&
    ALLOWED_LISTING_TYPES.includes(listingTypeParam as ListingType)
  ) {
    listingType = listingTypeParam as ListingType;
  } else if (listingTypeParam) {
    return NextResponse.json(
      {
        error: `Invalid parameter "type". Allowed values: ${ALLOWED_LISTING_TYPES.join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }

  // Validate and set limit, default handled by syncSubredditPosts
  let limit: number | undefined = undefined;
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
      // Reddit max limit is 100
      limit = parsedLimit;
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid parameter "limit". Must be a number between 1 and 100.',
        },
        { status: 400 }
      );
    }
  }

  // Validate time parameter (only relevant for 'top' and 'controversial')
  let time: TimeFrame | undefined = undefined;
  if ((listingType === "top" || listingType === "controversial") && timeParam) {
    if (ALLOWED_TIME_FRAMES.includes(timeParam as TimeFrame)) {
      time = timeParam as TimeFrame;
    } else {
      return NextResponse.json(
        {
          error: `Invalid parameter "time" for listing type "${listingType}". Allowed values: ${ALLOWED_TIME_FRAMES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }
  } else if (
    timeParam &&
    !(listingType === "top" || listingType === "controversial")
  ) {
    console.warn(
      `Parameter "time" provided but ignored for listing type "${listingType}".`
    );
  }

  // Prepare options for the sync function
  const options: { limit?: number; after?: string | null; time?: TimeFrame } = {
    limit: limit,
    after: afterParam ? afterParam : null, // Pass null if empty string or not provided
    time: time,
  };

  // --- Execute Sync Function ---
  try {
    console.log(
      `API request to sync posts for r/${subredditName} (type: ${listingType}, limit: ${
        limit ?? "default"
      }, after: ${afterParam ?? "none"}, time: ${time ?? "none"})`
    );

    const results: DbPost[] | null = await syncSubredditPosts(
      subredditName,
      listingType,
      options
    );

    if (results === null) {
      // This typically means the subreddit itself couldn't be synced/found
      return NextResponse.json(
        {
          success: false,
          message: `Could not sync posts for r/${subredditName}. Subreddit might not exist or failed to sync.`,
        },
        { status: 404 }
      );
    }

    console.log(
      `API sync completed for r/${subredditName}. Processed ${results.length} posts.`
    );
    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    }); // Return the upserted posts
  } catch (error: any) {
    console.error(`API Error syncing posts for r/${subredditName}:`, error);
    // Distinguish between known safe errors (like 404 from Reddit via safeRedditAPICall?) and others if needed
    return NextResponse.json(
      { success: false, error: error.message || "An unknown error occurred" },
      { status: 500 }
    );
  }
}

// Ensure this route is treated as dynamic to prevent caching issues during testing
export const dynamic = "force-dynamic";
