import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCategories } from "../entities/category/model/useCategories";
import { usePoints } from "../entities/point/model/usePoints";
import { api } from "../shared/api";

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, api: vi.fn() };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("data hooks", () => {
  it("loads categories", async () => {
    vi.mocked(api).mockResolvedValue([{ id: 1, name: "Parks", slug: "parks" }]);
    const { result } = renderHook(() => useCategories(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].name).toBe("Parks");
  });

  it("does not query points without bbox", () => {
    const { result } = renderHook(() => usePoints(undefined), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });

  it("loads points with category filter", async () => {
    vi.mocked(api).mockResolvedValue({ items: [{ id: 1, title: "T" }], total: 1, limit: 500, offset: 0 });
    const { result } = renderHook(() => usePoints("1,2,3,4", 5), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1, title: "T" }]);
    expect(vi.mocked(api).mock.calls[0][0]).toContain("category_id=5");
  });
});
