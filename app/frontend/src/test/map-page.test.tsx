import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapPage } from "../pages/map/MapPage";

vi.mock("../widgets/MapWidget", () => ({
  MapWidget: ({ onSelect }: { onSelect: (p: unknown) => void }) => <button onClick={() => onSelect({ id: 1, title: "Event", description: "Desc", category_name: "Parks", event_at: "2026-01-01T12:00:00Z", author_name: "Ann" })}>select</button>,
}));

vi.mock("../entities/category/model/useCategories", () => ({
  useCategories: vi.fn(() => ({ data: [{ id: 1, name: "Parks", slug: "parks" }], isLoading: false })),
}));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, api: vi.fn().mockResolvedValue({ id: 1 }) };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MapPage /></QueryClientProvider>);
}

it("opens create modal and submits a point request", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  expect(screen.getByRole("heading", { name: "Предложить точку" })).toBeInTheDocument();
  await user.type(screen.getByPlaceholderText(/городской фестиваль/), " Festival ");
  await user.selectOptions(screen.getByRole("combobox", { name: /Категория/ }), "1");
  await user.type(screen.getByPlaceholderText(/полезна горожанам/), " Description ");
  await user.type(screen.getByPlaceholderText(/к вам обращаться/), " Author ");
  const date = screen.getByDisplayValue("");
  expect(date).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Отмена" }));
  expect(screen.queryByRole("heading", { name: "Предложить точку" })).not.toBeInTheDocument();
});

it("shows selected point card and closes it", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "select" }));
  expect(screen.getByRole("heading", { name: "Event" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Закрыть карточку" }));
  expect(screen.queryByRole("heading", { name: "Event" })).not.toBeInTheDocument();
});
