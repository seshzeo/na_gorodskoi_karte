import { describe, expect, it, beforeEach, vi } from "vitest";
import { AuthBootstrap, useAuthStore } from "../features/auth/model/authStore";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";

const { apiMock, csrfMock, setCsrfMock, clearCsrfMock, ApiErrorMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  csrfMock: vi.fn(),
  setCsrfMock: vi.fn(),
  clearCsrfMock: vi.fn(),
  ApiErrorMock: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      public readonly detail: unknown,
    ) {
      super(typeof detail === "string" ? detail : code);
      this.name = "ApiError";
    }
  },
}));

vi.mock("../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/api")>();
  return {
    ...actual,
    api: (...args: unknown[]) => apiMock(...args),
    requestCsrfToken: (...args: unknown[]) => csrfMock(...args),
    setCsrfToken: (...args: unknown[]) => setCsrfMock(...args),
    clearCsrfToken: (...args: unknown[]) => clearCsrfMock(...args),
    ApiError: ApiErrorMock,
  };
});

beforeEach(() => {
  apiMock.mockReset();
  csrfMock.mockReset();
  setCsrfMock.mockReset();
  clearCsrfMock.mockReset();
  useAuthStore.setState({ moderator: null, status: "loading", error: null });
});

describe("auth store", () => {
  it("initializes an authenticated session", async () => {
    apiMock.mockResolvedValue({ id: "m1", username: "admin" });
    csrfMock.mockResolvedValue("csrf");

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().moderator?.username).toBe("admin");
    expect(setCsrfMock).toHaveBeenCalledWith("csrf");
  });

  it("initializes unauthenticated on 401", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(401, "unauthorized", "bad"));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("initializes error on server failure and preserves a server detail", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(500, "http_error", "down"));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("error");
    expect(useAuthStore.getState().error).toBe("down");
  });

  it("initializes with a security error on 403", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(403, "forbidden", "blocked"));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("error");
    expect(useAuthStore.getState().error).toContain("Проверка безопасности");
  });

  it("initializes with a generic error for an unknown failure", async () => {
    apiMock.mockRejectedValue(new Error("network down"));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe("error");
    expect(useAuthStore.getState().error).toContain("Не удалось связаться");
  });

  it("logs in and rotates csrf", async () => {
    csrfMock.mockResolvedValue("pre");
    apiMock.mockResolvedValue({ id: "m1", username: "admin", csrf_token: "post" });

    await useAuthStore.getState().login(" admin ", "password");

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(setCsrfMock).toHaveBeenCalledWith("post");
  });

  it("maps login 401 and rethrows", async () => {
    csrfMock.mockResolvedValue("pre");
    apiMock.mockRejectedValue(new ApiErrorMock(401, "unauthorized", "bad"));

    await expect(useAuthStore.getState().login("admin", "bad")).rejects.toBeInstanceOf(ApiErrorMock);

    expect(useAuthStore.getState().error).toBe("Неверный логин или пароль.");
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("maps login 403 and rethrows", async () => {
    csrfMock.mockResolvedValue("pre");
    apiMock.mockRejectedValue(new ApiErrorMock(403, "forbidden", "blocked"));

    await expect(useAuthStore.getState().login("admin", "bad")).rejects.toBeInstanceOf(ApiErrorMock);

    expect(useAuthStore.getState().error).toContain("Проверка безопасности");
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("maps an unknown login failure to a generic error and rethrows", async () => {
    csrfMock.mockResolvedValue("pre");
    apiMock.mockRejectedValue(new Error("network down"));

    await expect(useAuthStore.getState().login("admin", "bad")).rejects.toThrow("network down");

    expect(useAuthStore.getState().error).toContain("Не удалось связаться");
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("logs out successfully", async () => {
    apiMock.mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("treats logout 401 as an expired session", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(401, "unauthorized", "expired"));

    await expect(useAuthStore.getState().logout()).rejects.toBeInstanceOf(ApiErrorMock);

    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("rethrows a non-401 logout failure without changing the session state", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(500, "http_error", "down"));

    await expect(useAuthStore.getState().logout()).rejects.toBeInstanceOf(ApiErrorMock);

    expect(useAuthStore.getState().status).toBe("loading");
    expect(clearCsrfMock).not.toHaveBeenCalled();
  });
});


it("AuthBootstrap initializes the authentication store on mount", async () => {
  apiMock.mockResolvedValue({ id: "m1", username: "admin" });
  csrfMock.mockResolvedValue("csrf");

  const { container } = render(createElement(AuthBootstrap));

  expect(container).toBeEmptyDOMElement();

  await waitFor(() => {
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  expect(apiMock).toHaveBeenCalledWith("/auth/me");
  expect(csrfMock).toHaveBeenCalled();
  expect(setCsrfMock).toHaveBeenCalledWith("csrf");
});
