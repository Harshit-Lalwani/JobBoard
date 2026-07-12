import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as authApi from "../api/auth.js";
import { setAccessToken, setUnauthorizedHandler } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "loading" covers the initial silent-refresh attempt on page load; until it resolves we
  // don't know yet whether there's a valid session, so ProtectedRoute must not redirect early.
  const [status, setStatus] = useState("loading");

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("signed-out");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    authApi
      .refresh()
      .then(({ accessToken }) => {
        setAccessToken(accessToken);
        return authApi.me();
      })
      .then(({ user: restoredUser }) => {
        setUser(restoredUser);
        setStatus("signed-in");
      })
      .catch(() => {
        setAccessToken(null);
        setStatus("signed-out");
      });
  }, []);

  const register = useCallback(async (data) => {
    const { user: newUser, accessToken } = await authApi.register(data);
    setAccessToken(accessToken);
    setUser(newUser);
    setStatus("signed-in");
    return newUser;
  }, []);

  const login = useCallback(async (data) => {
    const { user: loggedInUser, accessToken } = await authApi.login(data);
    setAccessToken(accessToken);
    setUser(loggedInUser);
    setStatus("signed-in");
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, status, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
