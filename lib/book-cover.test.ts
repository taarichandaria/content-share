import { describe, expect, it } from "vitest";
import { coverImageUrl, pickCoverId } from "./book-cover";

describe("pickCoverId", () => {
  it("returns the first doc that has a cover", () => {
    expect(
      pickCoverId([{}, { cover_i: 95742 }, { cover_i: 13174172 }])
    ).toBe(95742);
  });

  it("returns null when no doc has a cover", () => {
    expect(pickCoverId([{}, {}])).toBeNull();
    expect(pickCoverId([])).toBeNull();
  });
});

describe("coverImageUrl", () => {
  it("builds the large covers.openlibrary.org url", () => {
    expect(coverImageUrl(95742)).toBe(
      "https://covers.openlibrary.org/b/id/95742-L.jpg"
    );
  });
});
