import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/jobboard",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "30d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};
