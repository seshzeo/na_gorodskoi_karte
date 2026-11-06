import { describe, expect, it, beforeEach, vi } from "vitest";
import { useAuthStore } from "../features/auth/model/authStore";

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
  });

  it("initializes unauthenticated on 401", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(401, "unauthorized", "bad"));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("initializes error on server failure", async () => {
    apiMock.mockRejectedValue(new ApiErrorMock(500, "http_error", "down"));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe("error");
    expect(useAuthStore.getState().error).toContain("Не удалось");
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
  });
});
