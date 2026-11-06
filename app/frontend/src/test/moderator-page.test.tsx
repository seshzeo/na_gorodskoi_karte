import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModeratorPage } from "../pages/moderator/ModeratorPage";

const auth = { moderator: null as any, status: "unauthenticated" as any, error: null as string | null, login: vi.fn(), logout: vi.fn(), initialize: vi.fn() };
const mutateAsync = vi.fn();

vi.mock("../features/auth/model/authStore", () => ({
  useAuthStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}));
vi.mock("../features/moderation/model/usePointRequests", () => ({
  usePointRequests: () => ({ data: { items: [{ id: 1, author_name: "Ann", title: "Event", description: "Desc", category_id: 1, latitude: 51.5, longitude: 46, event_at: "2026-01-01T12:00:00Z", status: "pending", rejection_reason: null, point_id: null, moderated_at: null, created_at: "2026-01-01T10:00:00Z" }], total: 1 }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
  useModeratePointRequest: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("../entities/category/model/useCategories", () => ({
  useCategories: () => ({ data: [{ id: 1, name: "Parks", slug: "parks" }], isLoading: false }),
}));

it("shows login and submits credentials", async () => {
  const user = userEvent.setup();
  render(<ModeratorPage />);
  await user.type(screen.getByPlaceholderText("Логин модератора"), "admin");
  await user.type(screen.getByPlaceholderText("Пароль модератора"), "password");
  await user.click(screen.getByRole("button", { name: "Войти" }));
  expect(auth.login).toHaveBeenCalledWith("admin", "password");
});

it("approves a pending request", async () => {
  const user = userEvent.setup();
  auth.status = "authenticated";
  auth.moderator = { id: "m1", username: "admin" };
  mutateAsync.mockResolvedValue({});
  render(<ModeratorPage />);
  expect(screen.getByText("Очередь заявок")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Одобрить заявку" }));
  expect(mutateAsync).toHaveBeenCalledWith({ id: 1, action: "approve" });
});

it("rejects a pending request with reason", async () => {
  const user = userEvent.setup();
  auth.status = "authenticated";
  auth.moderator = { id: "m1", username: "admin" };
  mutateAsync.mockResolvedValue({});
  render(<ModeratorPage />);
  await user.type(screen.getByPlaceholderText(/причину отказа/), "Недостаточно данных");
  await user.click(screen.getByRole("button", { name: "Отклонить заявку" }));
  expect(mutateAsync).toHaveBeenCalledWith({ id: 1, action: "reject", reason: "Недостаточно данных" });
});
