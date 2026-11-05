import { create } from "zustand";
import type { FormEvent } from "react";
import type { LoginResponse, Moderator } from "../../../entities";
import { api, ApiError, clearCsrfToken, requestCsrfToken, setCsrfToken } from "../../../shared/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthState = {
  moderator: Moderator | null;
  status: AuthStatus;
  error: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Неверный логин или пароль.";
    if (error.status === 403) return "Проверка безопасности не пройдена. Обновите страницу и попробуйте снова.";
    if (typeof error.detail === "string") return error.detail;
  }
  return "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";
}

let initialization: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  moderator: null,
  status: "loading",
  error: null,

  initialize: async () => {
    if (initialization) return initialization;

    initialization = (async () => {
      try {
        const moderator = await api<Moderator>("/auth/me");
        const csrfToken = await requestCsrfToken();
        setCsrfToken(csrfToken);
        set({ moderator, status: "authenticated", error: null });
      } catch (error) {
        clearCsrfToken();
        if (error instanceof ApiError && error.status === 401) {
          set({ moderator: null, status: "unauthenticated", error: null });
        } else {
          set({ moderator: null, status: "error", error: getErrorMessage(error) });
        }
      } finally {
        initialization = null;
      }
    })();

    return initialization;
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      await requestCsrfToken();
      const response = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setCsrfToken(response.csrf_token);
      set({ moderator: { id: response.id, username: response.username }, status: "authenticated", error: null });
    } catch (error) {
      set({ moderator: null, status: "unauthenticated", error: getErrorMessage(error) });
      throw error;
    }
  },

  logout: async () => {
    await api<void>("/auth/logout", { method: "POST" });
    clearCsrfToken();
    set({ moderator: null, status: "unauthenticated", error: null });
  },
}));

export function AuthBootstrap() {
  const initialize = useAuthStore((state) => state.initialize);
  ReactUseAuthBootstrap(initialize);
  return null;
}

function ReactUseAuthBootstrap(initialize: () => Promise<void>) {
  // Kept in a tiny component so session restoration runs once per app mount.
  const { useEffect } = requireReact();
  useEffect(() => {
    void initialize();
  }, [initialize]);
}

function requireReact() {
  return ReactHooks;
}

import * as ReactHooks from "react";
