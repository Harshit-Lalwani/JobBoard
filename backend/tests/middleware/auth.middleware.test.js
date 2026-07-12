import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole } from "../../src/middleware/auth.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { env } from "../../src/config/env.js";

function mockRes() {
  return { statusCode: null };
}

describe("requireAuth", () => {
  it("attaches req.user and calls next() with a valid Bearer token", () => {
    const token = signAccessToken({ _id: "user-1", role: "poster" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(req.user).toEqual({ id: "user-1", role: "poster" });
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(err) with 401 when the Authorization header is missing", () => {
    const req = { headers: {} };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next(err) with 401 for a malformed/invalid token", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next(err) with 401 when the header doesn't have a Bearer prefix", () => {
    const token = signAccessToken({ _id: "user-1", role: "poster" });
    const req = { headers: { authorization: token } }; // missing "Bearer " prefix
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("calls next(err) with 401 for an expired token", () => {
    const expiredToken = jwt.sign({ sub: "user-1", role: "poster" }, env.jwtAccessSecret, {
      expiresIn: -10, // already expired 10 seconds ago
    });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("rejects a token signed with the wrong secret", () => {
    const forgedToken = jwt.sign({ sub: "user-1", role: "poster" }, "wrong-secret", {
      expiresIn: "15m",
    });
    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const next = jest.fn();

    requireAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe("requireRole", () => {
  it("calls next() when req.user.role is in the allowed list", () => {
    const req = { user: { id: "user-1", role: "poster" } };
    const next = jest.fn();

    requireRole("poster", "applicant")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(err) with 403 when req.user.role is not allowed", () => {
    const req = { user: { id: "user-1", role: "applicant" } };
    const next = jest.fn();

    requireRole("poster")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("calls next(err) with 401 when req.user is missing (ran before requireAuth)", () => {
    const req = {};
    const next = jest.fn();

    requireRole("poster")(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
