import { env } from "../config/env.js";
import { parseDurationMs } from "../utils/duration.js";
import { ApiError } from "../middleware/errorHandler.js";
import * as authService from "../services/auth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "strict",
  maxAge: parseDurationMs(env.refreshTokenTtl),
  path: "/api/auth",
};

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

export async function register(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(201).json({ user: toPublicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.json({ user: toPublicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new ApiError(401, "Missing refresh token");
    }
    const { accessToken } = await authService.refresh(refreshToken);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user?.id) {
      await authService.logout(req.user.id);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: refreshCookieOptions.path });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Lets the frontend restore full user info after a silent refresh, since /refresh only
// returns a new access token (see agent-comms/DECISIONS.md on the refresh token design).
export async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}
