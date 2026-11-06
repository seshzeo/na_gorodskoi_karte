import { describe, expect, it, beforeEach, vi } from "vitest";
import { ApiError } from "../shared/api";
import { useAuthStore } from "../features/auth/model/authStore";

const apiMock = vi.fn();
const csrfMock = vi.fn();
const setCsrfMock = vi.fn();
const clearCsrfMock = vi.fn();

vi.mock("../shared/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  requestCsrfToken: (...args: unknown[]) => csrfMock(...args),
  setCsrfToken: (...args: unknown[]) => setCsrfMock(...args),
  clearCsrfToken: (...args: unknown[]) => clearCsrfMock(...args),
  ApiError,
}));

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
    apiMock.mockRejectedValue(new ApiError(401, "unauthorized", "bad"));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("initializes error on server failure", async () => {
    apiMock.mockRejectedValue(new ApiError(500, "http_error", "down"));
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
    apiMock.mockRejectedValue(new ApiError(401, "unauthorized", "bad"));
    await expect(useAuthStore.getState().login("admin", "bad")).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().error).toBe("Неверный логин или пароль.");
  });

  it("logs out successfully", async () => {
    apiMock.mockResolvedValue(undefined);
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(clearCsrfMock).toHaveBeenCalled();
  });

  it("treats logout 401 as an expired session", async () => {
    apiMock.mockRejectedValue(new ApiError(401, "unauthorized", "expired"));
    await expect(useAuthStore.getState().logout()).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
