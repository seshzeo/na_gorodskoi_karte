import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePointRequests, useModeratePointRequest } from "../features/moderation/model/usePointRequests";
import { api } from "../shared/api";

vi.mock("../shared/api", async () => ({ ...(await vi.importActual<typeof import("../shared/api")>("../shared/api")), api: vi.fn() }));

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

it("loads pending requests", async () => {
  vi.mocked(api).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  const { result } = renderHook(() => usePointRequests("pending"), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(api).mock.calls[0][0]).toContain("status=pending");
});

it("omits status for all", async () => {
  vi.mocked(api).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  const { result } = renderHook(() => usePointRequests("all"), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(vi.mocked(api).mock.calls[0][0]).not.toContain("status=");
});

it("approves a request", async () => {
  vi.mocked(api).mockResolvedValue({ id: 1, status: "approved" });
  const { result } = renderHook(() => useModeratePointRequest(), { wrapper: wrapper() });
  await result.current.mutateAsync({ id: 1, action: "approve" });
  expect(vi.mocked(api).mock.calls[0][0]).toBe("/point-requests/1/approve");
});

it("rejects a request", async () => {
  vi.mocked(api).mockResolvedValue({ id: 1, status: "rejected" });
  const { result } = renderHook(() => useModeratePointRequest(), { wrapper: wrapper() });
  await result.current.mutateAsync({ id: 1, action: "reject", reason: "Reason" });
  expect(vi.mocked(api).mock.calls[0][0]).toBe("/point-requests/1/reject");
});
