import { isLegalTransition, getLegalTransitions } from "../../src/utils/statusMachine.js";
import { APPLICATION_STATUSES } from "../../src/models/Application.js";

describe("isLegalTransition", () => {
  it.each([
    ["applied", "shortlisted"],
    ["applied", "rejected"],
    ["shortlisted", "interview"],
    ["shortlisted", "rejected"],
    ["interview", "offer"],
    ["interview", "rejected"],
    ["offer", "rejected"],
  ])("allows %s -> %s", (from, to) => {
    expect(isLegalTransition(from, to)).toBe(true);
  });

  it.each([
    ["applied", "interview"],
    ["applied", "offer"],
    ["shortlisted", "applied"],
    ["shortlisted", "offer"],
    ["interview", "applied"],
    ["interview", "shortlisted"],
    ["offer", "applied"],
    ["offer", "shortlisted"],
    ["offer", "interview"],
    ["rejected", "applied"],
    ["rejected", "shortlisted"],
    ["rejected", "interview"],
    ["rejected", "offer"],
  ])("rejects %s -> %s", (from, to) => {
    expect(isLegalTransition(from, to)).toBe(false);
  });

  it("rejects a no-op transition to the same status", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(isLegalTransition(status, status)).toBe(false);
    }
  });

  it("treats 'rejected' as a terminal state with zero legal outbound transitions", () => {
    expect(getLegalTransitions("rejected")).toEqual([]);
  });

  it("rejects statuses outside the known enum", () => {
    expect(isLegalTransition("applied", "hired")).toBe(false);
    expect(isLegalTransition("bogus", "applied")).toBe(false);
  });
});

describe("getLegalTransitions", () => {
  it("returns the exact set of legal next states for each status", () => {
    expect(getLegalTransitions("applied")).toEqual(["shortlisted", "rejected"]);
    expect(getLegalTransitions("shortlisted")).toEqual(["interview", "rejected"]);
    expect(getLegalTransitions("interview")).toEqual(["offer", "rejected"]);
    expect(getLegalTransitions("offer")).toEqual(["rejected"]);
    expect(getLegalTransitions("rejected")).toEqual([]);
  });

  it("returns an empty array for an unknown status rather than throwing", () => {
    expect(getLegalTransitions("not-a-status")).toEqual([]);
  });
});
