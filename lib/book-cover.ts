const FETCH_TIMEOUT_MS = 5_000;

export interface OpenLibraryDoc {
  cover_i?: number;
}

/** First search hit that actually has a cover; many editions don't. */
export function pickCoverId(docs: OpenLibraryDoc[]): number | null {
  for (const doc of docs) {
    if (typeof doc.cover_i === "number") return doc.cover_i;
  }
  return null;
}

export function coverImageUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

/**
 * Look up a cover image for a book via Open Library search. Never throws;
 * returns null when nothing matches so the composer simply shows no preview.
 */
export async function searchBookCover(
  title: string,
  author?: string | null
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      title,
      fields: "cover_i",
      limit: "5",
    });
    if (author) params.set("author", author);

    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { docs?: OpenLibraryDoc[] };
    const coverId = pickCoverId(data.docs ?? []);
    return coverId === null ? null : coverImageUrl(coverId);
  } catch {
    return null;
  }
}
