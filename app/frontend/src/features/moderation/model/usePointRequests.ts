import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PointRequestRead } from "../../../entities";
import { api } from "../../../shared/api";

export type RequestFilter = "pending" | "approved" | "rejected" | "all";

type ModerationAction =
  | { id: number; action: "approve" }
  | { id: number; action: "reject"; reason: string };

export function usePointRequests(status: RequestFilter) {
  return useQuery({
    queryKey: ["moderator", "point-requests", status],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (status !== "all") params.set("status", status);
      return api<PointRequestRead[]>(`/point-requests?${params.toString()}`);
    },
    staleTime: 15_000,
    gcTime: 300_000,
  });
}

export function useModeratePointRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ModerationAction) => {
      if (input.action === "approve") {
        return api<PointRequestRead>(`/point-requests/${input.id}/approve`, { method: "POST" });
      }
      return api<PointRequestRead>(`/point-requests/${input.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: input.reason }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderator", "point-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["points"] });
    },
  });
}
