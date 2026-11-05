import { useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api";
import type { Page, Point } from "../../../entities";

export function usePoints(bbox: string | undefined, categoryId?: number) {
  return useQuery({
    queryKey: ["points", bbox, categoryId],
    queryFn: async () => {
      const query = new URLSearchParams({ bbox: bbox!, limit: "500" });

      if (categoryId) {
        query.set("category_id", String(categoryId));
      }

      const page = await api<Page<Point>>(`/points?${query.toString()}`);
      return page.items;
    },
    enabled: Boolean(bbox),
    staleTime: 30_000,
    gcTime: 300_000,
  });
}
