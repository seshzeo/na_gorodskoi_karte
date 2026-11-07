import { describe, expect, it, beforeEach, vi } from "vitest";
import { ApiError, api, clearCsrfToken, getCsrfToken, requestCsrfToken, setCsrfToken } from "../shared/api";

describe("api client", () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("manages csrf token", () => {
    expect(getCsrfToken()).toBeNull();
    setCsrfToken("abc");
    expect(getCsrfToken()).toBe("abc");
    clearCsrfToken();
    expect(getCsrfToken()).toBeNull();
  });

  it("adds JSON and csrf headers for unsafe requests", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    setCsrfToken("csrf");
    await api("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const init = fetchMock.mock.calls[0][1]!;
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("csrf");
    expect(init.credentials).toBe("same-origin");
  });

  it("does not add csrf to safe requests and preserves explicit headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    setCsrfToken("csrf");
    await api("/x", { method: "GET", headers: { "X-CSRF-Token": "explicit" } });
    const headers = new Headers(fetchMock.mock.calls[0][1]!.headers);
    expect(headers.get("X-CSRF-Token")).toBe("explicit");
  });

  it("returns undefined for 204", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("parses JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ value: 7 }), { status: 200 }));
    await expect(api<{ value: number }>("/x")).resolves.toEqual({ value: 7 });
  });

  it("throws ApiError with JSON detail", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: "bad", detail: "No" }), { status: 400 }));
    await expect(api("/x")).rejects.toEqual(expect.objectContaining({ status: 400, code: "bad", detail: "No" }));
  });

  it("falls back for non-JSON errors", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("oops", { status: 500, statusText: "Server Error" }));
    await expect(api("/x")).rejects.toEqual(expect.objectContaining({ status: 500, code: "http_error", detail: "Server Error" }));
  });

  it("requests and stores csrf token", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ csrf_token: "new-token" }), { status: 200 }));
    await expect(requestCsrfToken()).resolves.toBe("new-token");
    expect(getCsrfToken()).toBe("new-token");
  });

  it("does not overwrite caller Content-Type", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await api("/x", { method: "POST", body: "raw", headers: { "Content-Type": "text/plain" } });
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]!.headers);
    expect(headers.get("Content-Type")).toBe("text/plain");
  });
});

it("ApiError uses string detail as message and code otherwise", () => {
  expect(new ApiError(400, "bad", "detail").message).toBe("detail");
  expect(new ApiError(400, "bad", { x: 1 }).message).toBe("bad");
});
