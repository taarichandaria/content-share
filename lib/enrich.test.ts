import { afterEach, describe, expect, it, vi } from "vitest";
import { enrichUnfurl } from "./enrich";
import type { UnfurlResult } from "./unfurl";

const parseMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse: parseMock };
  },
}));

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  parseMock.mockReset();
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("enrichUnfurl", () => {
  it("passes the result through when no api key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const input: UnfurlResult = {
      ok: true,
      url: "https://example.com",
      title: "Some Title — Example Press",
      suggestedType: "article",
    };
    expect(await enrichUnfurl(input)).toBe(input);
  });

  it("skips enrichment for failed unfurls", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-never-used";
    const input: UnfurlResult = {
      ok: false,
      url: "https://example.com",
      suggestedType: "article",
    };
    // ok=false returns before any client is constructed — no network call.
    expect(await enrichUnfurl(input)).toBe(input);
  });

  it("applies the model's cleaned title, creator, and type", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockResolvedValue({
      parsed_output: { title: "Aggregation Theory", creator: "Ben Thompson", type: "article" },
    });
    const input: UnfurlResult = {
      ok: true,
      url: "https://stratechery.com/2015/aggregation-theory/",
      title: "Aggregation Theory – Stratechery by Ben Thompson",
      description: "The disruption caused by the Internet has a common theme.",
      siteName: "Stratechery by Ben Thompson",
      suggestedType: "other",
    };
    const r = await enrichUnfurl(input);
    expect(r.title).toBe("Aggregation Theory");
    expect(r.creator).toBe("Ben Thompson");
    expect(r.suggestedType).toBe("article");
    expect(r.description).toBe(input.description);
  });

  it("drops the description when the cleaned title duplicates it", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // Tweets: og:title is "jack (@jack) on X" and og:description is the
    // tweet text, which the model promotes into the title.
    parseMock.mockResolvedValue({
      parsed_output: { title: "just setting up my twttr", creator: "jack", type: "tweet" },
    });
    const input: UnfurlResult = {
      ok: true,
      url: "https://x.com/jack/status/20",
      title: "jack (@jack) on X",
      description: "just setting up my twttr",
      siteName: "X (formerly Twitter)",
      suggestedType: "tweet",
    };
    const r = await enrichUnfurl(input);
    expect(r.title).toBe("just setting up my twttr");
    expect(r.description).toBeUndefined();
  });

  it("treats trailing punctuation and casing as duplicates too", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockResolvedValue({
      parsed_output: { title: "How to Get Rich (without getting lucky)", creator: "Naval", type: "tweet" },
    });
    const input: UnfurlResult = {
      ok: true,
      url: "https://twitter.com/naval/status/1002103360646823936",
      title: "Naval (@naval) on X",
      description: "How to Get Rich (without getting lucky):",
      siteName: "X (formerly Twitter)",
      suggestedType: "tweet",
    };
    const r = await enrichUnfurl(input);
    expect(r.description).toBeUndefined();
  });

  it("returns the raw result when the model call fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockRejectedValue(new Error("api down"));
    const input: UnfurlResult = {
      ok: true,
      url: "https://example.com",
      title: "Raw Title",
      suggestedType: "article",
    };
    expect(await enrichUnfurl(input)).toBe(input);
  });
});
