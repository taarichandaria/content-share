import * as cheerio from "cheerio";

export type ContentTypeSuggestion =
  | "article"
  | "blog"
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
  [/(^|\.)substack\.com$|(^|\.)medium\.com$/, "blog"],
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

/** Parse HTML into unfurled metadata. Pure function — easy to unit test. */
export function parseUnfurl(html: string, finalUrl: string): UnfurlResult {
  const $ = cheerio.load(html);

  const meta = (selector: string) =>
    $(selector).attr("content")?.trim() || undefined;

  const title =
    meta('meta[property="og:title"]') ||
    meta('meta[name="twitter:title"]') ||
    $("title").first().text().trim() ||
    undefined;

  const description =
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
    suggestedType,
  };
}

const MAX_BODY_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 5_000;

/**
 * Fetch a URL and extract link-preview metadata. Never throws: any failure
 * returns { ok: false } so the composer can fall back to manual entry.
 */
export async function unfurl(url: string): Promise<UnfurlResult> {
  const fallback: UnfurlResult = {
    ok: false,
    url,
    suggestedType: inferTypeFromUrl(url) ?? "article",
  };

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    if (isPrivateHost(parsed.hostname)) return fallback;

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
