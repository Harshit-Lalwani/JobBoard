import { computeSearchTerms } from "../../src/utils/searchTerms.js";

describe("computeSearchTerms", () => {
  it("lowercases and splits title+description into word tokens", () => {
    expect(computeSearchTerms("Machine Learning Engineer", "Build scalable systems")).toEqual(
      expect.arrayContaining(["machine", "learning", "engineer", "build", "scalable", "systems"])
    );
  });

  it("deduplicates repeated words", () => {
    const terms = computeSearchTerms("Engineer Engineer", "engineer");
    expect(terms.filter((t) => t === "engineer")).toHaveLength(1);
  });

  it("strips punctuation, treating it as a word boundary", () => {
    const terms = computeSearchTerms("Full-Stack Engineer", "Node.js expert");
    expect(terms).toEqual(expect.arrayContaining(["full", "stack", "engineer", "node", "js", "expert"]));
  });

  it("returns an empty array for empty input", () => {
    expect(computeSearchTerms("", "")).toEqual([]);
  });
});
