import { describe, expect, it } from "vitest";
import {
  getYouTubeVideoId,
  inferTypeFromUrl,
  isPrivateHost,
  parseUnfurl,
  youtubeThumbnailUrl,
} from "./unfurl";

const RICH_PAGE = `<!doctype html>
<html><head>
  <title>Fallback title</title>
  <meta property="og:title" content="How Buildings Learn" />
  <meta property="og:description" content="What happens after they're built." />
  <meta property="og:image" content="https://cdn.example.com/cover.jpg" />
  <meta property="og:site_name" content="Example Press" />
  <meta property="og:type" content="article" />
</head><body></body></html>`;

const MINIMAL_PAGE = `<!doctype html>
<html><head>
  <title>  Just a title  </title>
  <meta name="description" content="Plain meta description" />
</head><body></body></html>`;

const RELATIVE_IMAGE_PAGE = `<!doctype html>
<html><head>
  <meta property="og:title" content="Relative" />
  <meta property="og:image" content="/img/cover.png" />
</head><body></body></html>`;

const EMPTY_PAGE = `<!doctype html><html><head></head><body>nothing</body></html>`;

describe("parseUnfurl", () => {
  it("extracts open graph metadata", () => {
    const r = parseUnfurl(RICH_PAGE, "https://example.com/post");
    expect(r.ok).toBe(true);
    expect(r.title).toBe("How Buildings Learn");
    expect(r.description).toBe("What happens after they're built.");
    expect(r.imageUrl).toBe("https://cdn.example.com/cover.jpg");
    expect(r.siteName).toBe("Example Press");
    expect(r.suggestedType).toBe("article");
  });

  it("falls back to <title> and meta description", () => {
    const r = parseUnfurl(MINIMAL_PAGE, "https://www.blog.example.com/x");
    expect(r.ok).toBe(true);
    expect(r.title).toBe("Just a title");
    expect(r.description).toBe("Plain meta description");
    expect(r.siteName).toBe("blog.example.com");
  });

  it("resolves relative og:image against the final url", () => {
    const r = parseUnfurl(RELATIVE_IMAGE_PAGE, "https://example.com/a/b");
    expect(r.imageUrl).toBe("https://example.com/img/cover.png");
  });

  it("reports ok=false when no title can be found", () => {
    const r = parseUnfurl(EMPTY_PAGE, "https://example.com");
    expect(r.ok).toBe(false);
  });

  it("prefers host-based type inference over og:type", () => {
    const r = parseUnfurl(RICH_PAGE, "https://www.youtube.com/watch?v=abc");
    expect(r.suggestedType).toBe("video");
  });
});

describe("inferTypeFromUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=x", "video"],
    ["https://youtu.be/x", "video"],
    ["https://x.com/user/status/1", "tweet"],
    ["https://twitter.com/user/status/1", "tweet"],
    ["https://open.spotify.com/episode/abc", "podcast"],
    ["https://podcasts.apple.com/us/podcast/x", "podcast"],
    ["https://something.substack.com/p/post", "blog"],
    ["https://arxiv.org/abs/2401.00001", "paper"],
    ["https://www.goodreads.com/book/show/1", "book"],
  ])("%s -> %s", (url, expected) => {
    expect(inferTypeFromUrl(url)).toBe(expected);
  });

  it("returns null for unknown hosts", () => {
    expect(inferTypeFromUrl("https://example.com/a")).toBeNull();
  });

  it("does not match lookalike domains", () => {
    expect(inferTypeFromUrl("https://notyoutube.com/x")).toBeNull();
    expect(inferTypeFromUrl("https://youtube.com.evil.com/x")).toBeNull();
  });
});

describe("getYouTubeVideoId", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("extracts the id from %s", (url) => {
    expect(getYouTubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "https://www.youtube.com/@RickAstleyYT",
    "https://www.youtube.com/watch?v=too-short",
    "https://www.youtube.com/playlist?list=PL123",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    "not a url",
  ])("returns null for %s", (url) => {
    expect(getYouTubeVideoId(url)).toBeNull();
  });
});

describe("youtubeThumbnailUrl", () => {
  it("derives the ytimg thumbnail from a video id", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });
});

describe("isPrivateHost", () => {
  it.each([
    "localhost",
    "foo.local",
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.0.1",
    "0.0.0.0",
    "::1",
  ])("blocks %s", (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each(["example.com", "172.15.0.1", "172.32.0.1", "8.8.8.8"])(
    "allows %s",
    (host) => {
      expect(isPrivateHost(host)).toBe(false);
    }
  );
});
