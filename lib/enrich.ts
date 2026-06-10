import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ContentTypeSuggestion, UnfurlResult } from "@/lib/unfurl";

const CONTENT_TYPES = [
  "article",
  "podcast",
  "video",
  "tweet",
  "book",
  "paper",
  "other",
] as const;

const EnrichmentSchema = z.object({
  title: z.string(),
  creator: z.union([z.string(), z.null()]),
  type: z.enum(CONTENT_TYPES),
});

const SYSTEM_PROMPT = `You clean up scraped link metadata for a content-sharing feed among friends.

Given raw metadata for a shared link, return:
- title: the cleaned display title. Strip site-name suffixes ("— The Verge", "| WIRED"), SEO cruft, bracketed show tags ("[Invest Like the Best, EP.419]"), and episode numbers. Keep the guest/topic. Fix ALL-CAPS or broken casing. Do not translate, paraphrase, or shorten an already-clean title.
- creator: the human-friendly author, show, or channel name. Prefer the show over the platform ("Invest Like the Best", not "Spotify"). Trim taglines ("with Patrick O'Shaughnessy" stays only if part of the show's actual name is unclear — prefer the shorter recognizable name). Use null when the metadata gives no credible creator — never supply one from your own knowledge of the work; only what the metadata supports (the URL or site name counts).
- type: the best-fitting content type for what the link points to.

Work only from the metadata given. Return the cleaned values, never commentary.`;

const ENRICH_TIMEOUT_MS = 10_000;

/** Case/trailing-punctuation-insensitive comparison key. */
function dedupeKey(s: string): string {
  return s
    .trim()
    .replace(/[\s\p{P}]+$/u, "")
    .toLowerCase();
}

/**
 * Use Haiku to normalize unfurled metadata (clean title, creator, type).
 * Best-effort: returns the input unchanged when no API key is configured,
 * the result has nothing to clean, or the call fails.
 */
export async function enrichUnfurl(result: UnfurlResult): Promise<UnfurlResult> {
  if (!process.env.ANTHROPIC_API_KEY) return result;
  if (!result.ok || !result.title) return result;

  try {
    const client = new Anthropic({
      timeout: ENRICH_TIMEOUT_MS,
      maxRetries: 1,
    });

    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            url: result.url,
            title: result.title,
            description: result.description ?? null,
            siteName: result.siteName ?? null,
            creator: result.creator ?? null,
            typeGuess: result.suggestedType,
          }),
        },
      ],
      output_config: { format: zodOutputFormat(EnrichmentSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed || !parsed.title.trim()) return result;

    const title = parsed.title.trim();
    return {
      ...result,
      title,
      creator: parsed.creator?.trim() || result.creator,
      // Tweets and similar pages put the body text in og:description, which
      // the model promotes into the title — don't show the same line twice.
      description:
        result.description && dedupeKey(result.description) === dedupeKey(title)
          ? undefined
          : result.description,
      suggestedType: parsed.type as ContentTypeSuggestion,
    };
  } catch {
    // Enrichment is a nice-to-have — the raw unfurl is always usable.
    return result;
  }
}
