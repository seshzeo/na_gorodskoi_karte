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
  usePointRequests: () => ({ data: { items: [], total: 0 }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
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
