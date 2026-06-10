import * as cheerio from "cheerio";
import { searchBooks } from "./books";

export type ContentTypeSuggestion =
  | "article"
  | "podcast"
  | "video"
  | "tweet"
  | "book"
  | "paper"
  | "other";

export interface UnfurlResult {
  ok: boolean;
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  creator?: string;
  suggestedType: ContentTypeSuggestion;
}

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // IPv6 unique-local
  /^\[?fe80:/i, // IPv6 link-local
];

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname));
}

const HOST_TYPE_MAP: Array<[RegExp, ContentTypeSuggestion]> = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$/, "video"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, "tweet"],
  [/(^|\.)open\.spotify\.com$|(^|\.)podcasts\.apple\.com$|(^|\.)overcast\.fm$|(^|\.)pca\.st$/, "podcast"],
  [/(^|\.)substack\.com$|(^|\.)medium\.com$/, "article"],
  [/(^|\.)arxiv\.org$/, "paper"],
  [/(^|\.)goodreads\.com$/, "book"],
];

export function inferTypeFromUrl(url: string): ContentTypeSuggestion | null {
  try {
    const { hostname } = new URL(url);
    for (const [re, type] of HOST_TYPE_MAP) {
      if (re.test(hostname)) return type;
    }
  } catch {
    // fall through
  }
  return null;
}

function inferTypeFromOg(ogType: string | undefined): ContentTypeSuggestion | null {
  if (!ogType) return null;
  const t = ogType.toLowerCase();
  if (t.includes("video")) return "video";
  if (t.includes("article")) return "article";
  if (t.includes("book")) return "book";
  if (t.includes("music") || t.includes("audio")) return "podcast";
  return null;
}

function nameFromJsonLdAuthor(author: unknown): string | undefined {
  if (typeof author === "string") return author.trim() || undefined;
  if (Array.isArray(author)) {
    const names = author.map(nameFromJsonLdAuthor).filter(Boolean);
    return names.length ? names.join(", ") : undefined;
  }
  if (author && typeof author === "object" && "name" in author) {
    const name = (author as { name?: unknown }).name;
    if (typeof name === "string") return name.trim() || undefined;
  }
  return undefined;
}

/** Many sites (esp. news) only expose the byline via JSON-LD. */
function jsonLdCreator($: cheerio.CheerioAPI): string | undefined {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data: unknown = JSON.parse($(el).text());
      const nodes: unknown[] = Array.isArray(data)
        ? data
        : ((data as { "@graph"?: unknown[] })["@graph"] ?? [data]);
      for (const node of nodes) {
        const name = nameFromJsonLdAuthor(
          (node as { author?: unknown })?.author
        );
        if (name) return name;
      }
    } catch {
      // malformed block — keep looking
    }
  }
  return undefined;
}

/** Academic pages (arXiv, ACM, Nature, …) list authors via Highwire citation tags. */
function citationCreator($: cheerio.CheerioAPI): string | undefined {
  const authors = $('meta[name="citation_author"]')
    .toArray()
    .map((el) => {
      const name = $(el).attr("content")?.trim() ?? "";
      // citation_author is conventionally "Last, First".
      const m = name.match(/^([^,]+),\s*(.+)$/);
      return m ? `${m[2]} ${m[1]}` : name;
    })
    .filter(Boolean);
  if (authors.length === 0) return undefined;
  return authors.length > 3 ? `${authors[0]} et al.` : authors.join(", ");
}

const SPOTIFY_DESC_LABELS = new Set([
  "Episode",
  "Song",
  "Single",
  "Album",
  "Playlist",
  "Podcast",
]);

/**
 * Spotify pages don't expose the show/artist in any author field — it only
 * appears in og:description boilerplate like "Invest Like the Best · Episode"
 * or "Artist · Album · Song · 2015". Returns the leading name when the
 * description matches that shape.
 */
export function spotifyCreatorFromDescription(
  description: string
): string | undefined {
  const parts = description.split(" · ").map((p) => p.trim());
  if (parts.length < 2) return undefined;
  return parts.some((p) => SPOTIFY_DESC_LABELS.has(p)) ? parts[0] : undefined;
}

/** Parse HTML into unfurled metadata. Pure function — easy to unit test. */
export function parseUnfurl(html: string, finalUrl: string): UnfurlResult {
  const $ = cheerio.load(html);

  const meta = (selector: string) =>
    $(selector).attr("content")?.trim() || undefined;

  // article:author is spec'd as a profile URL; only use it when it's a name.
  const nonUrl = (value: string | undefined) =>
    value && !/^https?:\/\//i.test(value) ? value : undefined;

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    $("title").first().text().trim() ||
    undefined;

  let description =
    meta('meta[property="og:description"]') ||
    meta('meta[name="twitter:description"]') ||
    meta('meta[name="description"]');

  let imageUrl =
    meta('meta[property="og:image"]') ||
    meta('meta[property="og:image:url"]') ||
    meta('meta[name="twitter:image"]');

  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, finalUrl).toString();
    } catch {
      imageUrl = undefined;
    }
  }

  let creator =
    meta('meta[name="author"]') ||
    citationCreator($) ||
    nonUrl(meta('meta[property="article:author"]')) ||
    jsonLdCreator($);

  try {
    if (/(^|\.)open\.spotify\.com$/.test(new URL(finalUrl).hostname) && description) {
      const name = spotifyCreatorFromDescription(description);
      if (name) {
        creator ||= name;
        description = undefined; // boilerplate, not a real description
      }
    }
  } catch {
    // unparseable finalUrl — skip the host-specific tweak
  }

  let siteName = meta('meta[property="og:site_name"]');
  if (!siteName) {
    try {
      siteName = new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      siteName = undefined;
    }
  }

  const suggestedType =
    inferTypeFromUrl(finalUrl) ??
    inferTypeFromOg(meta('meta[property="og:type"]')) ??
    "article";

  return {
    ok: Boolean(title),
    url: finalUrl,
    title,
    description,
    imageUrl,
    siteName,
    creator,
    suggestedType,
  };
}

const YT_HOSTS = new Set(["youtube.com", "music.youtube.com", "youtube-nocookie.com"]);
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Extract the video id from watch/shorts/embed/live/youtu.be URLs. */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    let candidate: string | null | undefined;
    if (host === "youtu.be") {
      candidate = u.pathname.split("/")[1];
    } else if (YT_HOSTS.has(host)) {
      candidate =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
    }
    return candidate && YT_ID_RE.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Every public video has this thumbnail, derivable without any fetch. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * YouTube serves scrapers a consent/bot page with no OG tags, so unfurl
 * videos via the public oEmbed endpoint instead. Even when oEmbed fails
 * (private/unlisted videos), the id-derived thumbnail still works.
 */
async function unfurlYouTube(url: string, videoId: string): Promise<UnfurlResult> {
  const base: UnfurlResult = {
    ok: false,
    url,
    imageUrl: youtubeThumbnailUrl(videoId),
    siteName: "YouTube",
    suggestedType: "video",
  };
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "application/json" },
      }
    );
    if (!res.ok) return base;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title) return base;
    return {
      ...base,
      ok: true,
      title: data.title,
      creator: data.author_name,
      imageUrl: data.thumbnail_url || base.imageUrl,
    };
  } catch {
    return base;
  }
}

/**
 * Title query baked into a Goodreads book URL slug, e.g.
 * /book/show/3735293-clean-code or /it/book/show/4671.The_Great_Gatsby.
 */
export function goodreadsBookQuery(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)goodreads\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/book\/show\/\d+[-.]([^/]+)/);
    if (!m) return null;
    const q = decodeURIComponent(m[1]).replace(/[-_.]+/g, " ").trim();
    return q || null;
  } catch {
    return null;
  }
}

/**
 * Goodreads sits behind an AWS WAF bot challenge that serves scrapers an
 * empty 202, so when the page fetch yields nothing, resolve the book through
 * Open Library search — the same source the composer's book autocomplete uses.
 */
async function unfurlGoodreads(
  url: string,
  titleQuery: string
): Promise<UnfurlResult> {
  const base: UnfurlResult = {
    ok: false,
    url,
    siteName: "Goodreads",
    suggestedType: "book",
  };
  const [book] = await searchBooks(titleQuery);
  if (!book) return base;
  return {
    ...base,
    ok: true,
    title: book.title,
    creator: book.author ?? undefined,
    imageUrl: book.coverUrl ?? undefined,
  };
}

const MAX_BODY_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Fetch a URL and extract link-preview metadata. Never throws: any failure
 * returns { ok: false } so the composer can fall back to manual entry.
 */
export async function unfurl(url: string): Promise<UnfurlResult> {
  const result = await unfurlGeneric(url);
  if (!result.ok) {
    const bookQuery = goodreadsBookQuery(url);
    if (bookQuery) return unfurlGoodreads(url, bookQuery);
  }
  return result;
}

async function unfurlGeneric(url: string): Promise<UnfurlResult> {
  const fallback: UnfurlResult = {
    ok: false,
    url,
    suggestedType: inferTypeFromUrl(url) ?? "article",
  };

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    if (isPrivateHost(parsed.hostname)) return fallback;

    const videoId = getYouTubeVideoId(url);
    if (videoId) return unfurlYouTube(url, videoId);

    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ContentShareBot/1.0; +https://github.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) return fallback;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return fallback;

    const finalUrl = res.url || url;
    if (isPrivateHost(new URL(finalUrl).hostname)) return fallback;

    // Read at most MAX_BODY_BYTES — OG tags live in <head>, so this is plenty.
    const reader = res.body?.getReader();
    if (!reader) return fallback;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    reader.cancel().catch(() => {});

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concatChunks(chunks, received)
    );

    return parseUnfurl(html, finalUrl);
  } catch {
    return fallback;
  }
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
