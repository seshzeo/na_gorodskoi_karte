import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryFilter } from "../features/filter-points/ui/CategoryFilter";

vi.mock("../entities/category/model/useCategories", () => ({
  useCategories: vi.fn(() => ({ data: [{ id: 1, name: "Парки", slug: "parks" }], isLoading: false })),
}));

it("renders categories and emits selected value", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<CategoryFilter value={undefined} onChange={onChange} />);
  expect(screen.getByRole("option", { name: "Все категории" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Парки" })).toBeInTheDocument();
  await user.selectOptions(screen.getByRole("combobox"), "1");
  expect(onChange).toHaveBeenCalledWith(1);
  await user.selectOptions(screen.getByRole("combobox"), "");
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});

it("disables category filter while loading", async () => {
  const module = await import("../entities/category/model/useCategories");
  vi.mocked(module.useCategories).mockReturnValue({ data: undefined, isLoading: true } as never);
  render(<CategoryFilter value={undefined} onChange={() => undefined} />);
  expect(screen.getByRole("combobox")).toBeDisabled();
});
