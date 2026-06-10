/** A book suggestion from the Open Library search API. */
export interface BookSuggestion {
  title: string;
  author: string | null;
  year: number | null;
  coverUrl: string | null;
  url: string | null;
}

export const BOOK_SEARCH_LIMIT = 6;
const FETCH_TIMEOUT_MS = 5_000;

/** Parse an Open Library search payload. Pure function — easy to unit test. */
export function parseBookSearch(payload: unknown): BookSuggestion[] {
  if (typeof payload !== "object" || payload === null) return [];
  const docs = (payload as { docs?: unknown }).docs;
  if (!Array.isArray(docs)) return [];

  const suggestions: BookSuggestion[] = [];
  for (const doc of docs) {
    if (typeof doc !== "object" || doc === null) continue;
    const d = doc as {
      title?: unknown;
      author_name?: unknown;
      first_publish_year?: unknown;
      cover_i?: unknown;
      key?: unknown;
    };
    if (typeof d.title !== "string" || !d.title.trim()) continue;

    const author =
      Array.isArray(d.author_name) && typeof d.author_name[0] === "string"
        ? d.author_name[0]
        : null;

    suggestions.push({
      title: d.title.trim(),
      author,
      year: typeof d.first_publish_year === "number" ? d.first_publish_year : null,
      coverUrl:
        typeof d.cover_i === "number"
          ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
          : null,
      url: typeof d.key === "string" ? `https://openlibrary.org${d.key}` : null,
    });
    if (suggestions.length >= BOOK_SEARCH_LIMIT) break;
  }
  return suggestions;
}

/**
 * Search Open Library for books matching the query. Never throws: any
 * failure returns [] so the composer quietly falls back to manual entry.
 */
export async function searchBooks(query: string): Promise<BookSuggestion[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(BOOK_SEARCH_LIMIT),
      fields: "key,title,author_name,first_publish_year,cover_i",
    });
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    return parseBookSearch(await res.json());
  } catch {
    return [];
  }
}
