import { describe, expect, it } from "vitest";
import { BOOK_SEARCH_LIMIT, parseBookSearch } from "./books";

const PAYLOAD = {
  numFound: 2,
  docs: [
    {
      key: "/works/OL27448W",
      title: "The Lord of the Rings",
      author_name: ["J.R.R. Tolkien", "Someone Else"],
      first_publish_year: 1954,
      cover_i: 9255566,
    },
    {
      key: "/works/OL123W",
      title: "Untitled Companion",
    },
  ],
};

describe("parseBookSearch", () => {
  it("maps docs to suggestions", () => {
    const [first, second] = parseBookSearch(PAYLOAD);
    expect(first).toEqual({
      title: "The Lord of the Rings",
      author: "J.R.R. Tolkien",
      year: 1954,
      coverUrl: "https://covers.openlibrary.org/b/id/9255566-M.jpg",
      url: "https://openlibrary.org/works/OL27448W",
    });
    expect(second).toEqual({
      title: "Untitled Companion",
      author: null,
      year: null,
      coverUrl: null,
      url: "https://openlibrary.org/works/OL123W",
    });
  });

  it("skips docs without a usable title", () => {
    const result = parseBookSearch({
      docs: [{ title: "  " }, { author_name: ["X"] }, null, { title: "Ok" }],
    });
    expect(result).toEqual([
      { title: "Ok", author: null, year: null, coverUrl: null, url: null },
    ]);
  });

  it("caps results at the search limit", () => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ title: `Book ${i}` }));
    expect(parseBookSearch({ docs })).toHaveLength(BOOK_SEARCH_LIMIT);
  });

  it.each([null, "nope", 42, {}, { docs: "x" }])(
    "returns [] for malformed payload %#",
    (payload) => {
      expect(parseBookSearch(payload)).toEqual([]);
    }
  );
});
