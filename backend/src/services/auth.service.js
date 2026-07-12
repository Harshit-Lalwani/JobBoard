import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { ApiError } from "../middleware/errorHandler.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashRefreshToken, compareRefreshToken } from "../utils/refreshToken.js";

const PASSWORD_HASH_ROUNDS = 10;

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = await hashRefreshToken(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
}

export async function register({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const user = await User.create({ name, email, passwordHash, role });
  const tokens = await issueTokens(user);

  return { user, ...tokens };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  const tokens = await issueTokens(user);
  return { user, ...tokens };
}

export async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  // Revocation check — rejects a still-unexpired token if the user has logged out since it
  // was issued. Static (non-rotating) refresh token by design: only a new access token comes
  // back here, the refresh token/cookie itself is left as-is. See agent-comms/DECISIONS.md.
  const matches = await compareRefreshToken(refreshToken, user.refreshTokenHash);
  if (!matches) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const accessToken = signAccessToken(user);
  return { user, accessToken };
}

export async function logout(userId) {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
}
