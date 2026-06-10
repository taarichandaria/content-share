import { describe, expect, it } from "vitest";
import {
  getYouTubeVideoId,
  goodreadsBookQuery,
  inferTypeFromUrl,
  isPrivateHost,
  parseUnfurl,
  spotifyCreatorFromDescription,
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

  it("extracts the author from meta name=author", () => {
    const page = `<html><head>
      <title>T</title>
      <meta name="author" content="Jane Doe" />
    </head></html>`;
    const r = parseUnfurl(page, "https://example.com");
    expect(r.creator).toBe("Jane Doe");
  });

  it("uses article:author only when it is a name, not a profile url", () => {
    const named = `<html><head><title>T</title>
      <meta property="article:author" content="John Smith" />
    </head></html>`;
    expect(parseUnfurl(named, "https://example.com").creator).toBe(
      "John Smith"
    );

    const linked = `<html><head><title>T</title>
      <meta property="article:author" content="https://example.com/people/js" />
    </head></html>`;
    expect(parseUnfurl(linked, "https://example.com").creator).toBeUndefined();
  });

  it("falls back to JSON-LD author, including @graph and arrays", () => {
    const page = `<html><head><title>T</title>
      <script type="application/ld+json">not json</script>
      <script type="application/ld+json">
        {"@graph":[{"@type":"WebSite"},{"@type":"NewsArticle","author":[{"name":"Ada Lovelace"},{"name":"Alan Turing"}]}]}
      </script>
    </head></html>`;
    const r = parseUnfurl(page, "https://example.com");
    expect(r.creator).toBe("Ada Lovelace, Alan Turing");
  });

  it("reads authors from Highwire citation tags, flipping Last, First", () => {
    const page = `<html><head><title>Attention Is All You Need</title>
      <meta name="citation_author" content="Vaswani, Ashish" />
      <meta name="citation_author" content="Shazeer, Noam" />
      <meta name="citation_author" content="Parmar, Niki" />
      <meta name="citation_author" content="Uszkoreit, Jakob" />
    </head></html>`;
    const r = parseUnfurl(page, "https://arxiv.org/abs/1706.03762");
    expect(r.creator).toBe("Ashish Vaswani et al.");
    expect(r.suggestedType).toBe("paper");
  });

  it("lists up to three citation authors in full", () => {
    const page = `<html><head><title>T</title>
      <meta name="citation_author" content="Curie, Marie" />
      <meta name="citation_author" content="Pierre Curie" />
    </head></html>`;
    const r = parseUnfurl(page, "https://example.com");
    expect(r.creator).toBe("Marie Curie, Pierre Curie");
  });

  it("prefers meta name=author over citation tags", () => {
    const page = `<html><head><title>T</title>
      <meta name="author" content="Jane Doe" />
      <meta name="citation_author" content="Smith, John" />
    </head></html>`;
    expect(parseUnfurl(page, "https://example.com").creator).toBe("Jane Doe");
  });

  it("leaves creator undefined when nothing credible exists", () => {
    const r = parseUnfurl(RICH_PAGE, "https://example.com");
    expect(r.creator).toBeUndefined();
  });

  it("pulls the show out of Spotify's og:description boilerplate", () => {
    const page = `<html><head>
      <meta property="og:title" content="Neil Mehta - Finding Future S&P 500 Companies" />
      <meta property="og:description" content="Invest Like the Best with Patrick O'Shaughnessy · Episode" />
    </head></html>`;
    const r = parseUnfurl(
      page,
      "https://open.spotify.com/episode/4HlsSp3C7o67RhCvX6TUrA"
    );
    expect(r.creator).toBe("Invest Like the Best with Patrick O'Shaughnessy");
    // The boilerplate is metadata, not prose — don't keep it as a description.
    expect(r.description).toBeUndefined();
    expect(r.suggestedType).toBe("podcast");
  });

  it("does not treat ordinary descriptions as Spotify boilerplate", () => {
    const page = `<html><head>
      <meta property="og:title" content="T" />
      <meta property="og:description" content="A real sentence about the episode." />
    </head></html>`;
    const r = parseUnfurl(page, "https://open.spotify.com/episode/abc");
    expect(r.creator).toBeUndefined();
    expect(r.description).toBe("A real sentence about the episode.");
  });

  it("ignores the spotify pattern on other hosts", () => {
    const page = `<html><head>
      <meta property="og:title" content="T" />
      <meta property="og:description" content="Someone · Episode" />
    </head></html>`;
    const r = parseUnfurl(page, "https://example.com/x");
    expect(r.creator).toBeUndefined();
    expect(r.description).toBe("Someone · Episode");
  });
});

describe("spotifyCreatorFromDescription", () => {
  it.each([
    ["Invest Like the Best with Patrick O'Shaughnessy · Episode", "Invest Like the Best with Patrick O'Shaughnessy"],
    ["Rick Astley · Whenever You Need Somebody · Song · 1987", "Rick Astley"],
    ["Acquired · Podcast", "Acquired"],
  ])("%s -> %s", (desc, expected) => {
    expect(spotifyCreatorFromDescription(desc)).toBe(expected);
  });

  it.each([
    "Just a plain description",
    "A sentence · with separators · but no labels",
  ])("returns undefined for %s", (desc) => {
    expect(spotifyCreatorFromDescription(desc)).toBeUndefined();
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
    ["https://something.substack.com/p/post", "article"],
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

describe("goodreadsBookQuery", () => {
  it.each([
    ["https://www.goodreads.com/book/show/3735293-clean-code", "clean code"],
    ["https://www.goodreads.com/book/show/4671.The_Great_Gatsby", "The Great Gatsby"],
    ["https://www.goodreads.com/it/book/show/4671.The_Great_Gatsby", "The Great Gatsby"],
    ["https://goodreads.com/book/show/11084145-steve-jobs?ref=nav", "steve jobs"],
  ])("%s -> %s", (url, expected) => {
    expect(goodreadsBookQuery(url)).toBe(expected);
  });

  it.each([
    "https://www.goodreads.com/book/show/3735293", // bare id, nothing to search
    "https://www.goodreads.com/author/show/3389.Stephen_King",
    "https://example.com/book/show/123-some-title",
    "not a url",
  ])("returns null for %s", (url) => {
    expect(goodreadsBookQuery(url)).toBeNull();
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
