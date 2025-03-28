import { NextResponse, type NextRequest } from "next/server";
import { backfillSubredditPosts } from "@/src/lib/tasks/backfillSubredditPosts";
import type {
  ListingType,
  TimeFrame,
} from "@/src/lib/tasks/syncSubredditPosts"; // Adjust import if needed

// Re-define or import allowed types if not already accessible
const ALLOWED_LISTING_TYPES: ListingType[] = [
  "hot",
  "new",
  "top",
  "controversial",
];
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
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Extract Query Parameters ---
  const { searchParams } = new URL(request.url);
  const subredditName = searchParams.get("name");
  const listingTypeParam = searchParams.get("type")?.toLowerCase() || "top"; // Default to 'top' for backfill
  const timeParam = searchParams.get("time")?.toLowerCase();
  const maxPagesParam = searchParams.get("maxPages");
  const afterParam = searchParams.get("after"); // Allow starting from a specific point

  // --- Validate Parameters ---
  if (!subredditName) {
    return NextResponse.json(
      { error: 'Missing required parameter: "name"' },
      { status: 400 }
    );
  }

  let listingType: ListingType = "top";
  if (ALLOWED_LISTING_TYPES.includes(listingTypeParam as ListingType)) {
    listingType = listingTypeParam as ListingType;
  } else {
    return NextResponse.json(
      {
        error: `Invalid parameter "type". Allowed: ${ALLOWED_LISTING_TYPES.join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }

  let timeFrame: TimeFrame | undefined = undefined;
  if (listingType === "top") {
    if (!timeParam) {
      return NextResponse.json(
        { error: 'Missing required parameter "time" for type="top"' },
        { status: 400 }
      );
    }
    if (ALLOWED_TIME_FRAMES.includes(timeParam as TimeFrame)) {
      timeFrame = timeParam as TimeFrame;
    } else {
      return NextResponse.json(
        {
          error: `Invalid parameter "time". Allowed: ${ALLOWED_TIME_FRAMES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }
  }

  let maxPages: number | undefined = undefined;
  if (maxPagesParam) {
    const parsedPages = parseInt(maxPagesParam, 10);
    if (!isNaN(parsedPages) && parsedPages > 0) {
      maxPages = parsedPages; // Limit enforced within backfillSubredditPosts
    } else {
      return NextResponse.json(
        { error: 'Invalid parameter "maxPages". Must be a positive number.' },
        { status: 400 }
      );
    }
  }

  // --- Execute Backfill Function ---
  try {
    console.log(
      `API request to BACKFILL posts for r/${subredditName} (type: ${listingType}, time: ${
        timeFrame ?? "N/A"
      }, maxPages: ${maxPages ?? "default"}, after: ${afterParam ?? "none"})`
    );

    // NOTE: This might exceed serverless function time limits for large backfills!
    const result = await backfillSubredditPosts(subredditName, listingType, {
      timeFrame: timeFrame,
      maxPages: maxPages,
      initialAfter: afterParam ? afterParam : null,
    });

    console.log(
      `API backfill finished for r/${subredditName}. Status: ${result.status}, Message: ${result.message}`
    );

    // Return the summary result
    return NextResponse.json({
      success: result.status !== "error" && result.status !== "no_subreddit",
      ...result,
    });
  } catch (error: any) {
    // This catch block might not be reached if backfillSubredditPosts handles its own errors,
    // but good practice to have it.
    console.error(
      `API Error during backfill trigger for r/${subredditName}:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: error.message || "An unknown API error occurred",
      },
      { status: 500 }
    );
  }
}

// Ensure this route is dynamic
export const dynamic = "force-dynamic";
