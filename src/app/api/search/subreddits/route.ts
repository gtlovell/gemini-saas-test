import { NextResponse, type NextRequest } from "next/server";
import {
  searchSubreddits,
  SubredditSearchResult,
} from "@/src/lib/search/subredditSearch";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const categoriesParam = searchParams.get("categories"); // Comma-separated category UUIDs
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const sortByParam = searchParams.get("sortBy");
  const ascendingParam = searchParams.get("ascending");

  if (!query) {
    return NextResponse.json(
      { error: 'Missing search query parameter "q"' },
      { status: 400 }
    );
  }

  let categoryIds: string[] | undefined;
  if (categoriesParam) {
    categoryIds = categoriesParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);
    // Basic UUID validation could be added here
  }

  let limit: number | undefined;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) limit = parsed;
  }

  let offset: number | undefined;
  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (!isNaN(parsed) && parsed >= 0) offset = parsed;
  }

  // Basic validation for sortBy and ascending could be added here

  try {
    const results: SubredditSearchResult[] = await searchSubreddits({
      query: query,
      categoryIds: categoryIds,
      limit: limit,
      offset: offset,
      // Add sortBy and ascending parsing later if needed
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("[API /search/subreddits] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Search failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; // Ensure it runs dynamically
