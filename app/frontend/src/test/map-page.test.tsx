import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapPage } from "../pages/map/MapPage";
import { api } from "../shared/api";

vi.mock("../widgets/MapWidget", () => ({
  MapWidget: ({ onSelect }: { onSelect: (p: unknown) => void }) => (
    <button onClick={() => onSelect({
      id: 1, title: "Event", description: "Desc", category_name: "Parks",
      event_at: "2026-01-01T12:00:00Z", author_name: "Ann",
    })}>select</button>
  ),
}));

vi.mock("../entities/category/model/useCategories", () => ({
  useCategories: vi.fn(() => ({
    data: [{ id: 1, name: "Parks", slug: "parks" }],
    isLoading: false,
  })),
}));

vi.mock("../shared/api", async () => {
  const actual = await vi.importActual<typeof import("../shared/api")>("../shared/api");
  return { ...actual, api: vi.fn().mockResolvedValue({ id: 1 }) };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MapPage /></QueryClientProvider>);
}

it("submits a complete point request and closes the modal after success", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockClear();
  renderPage();

  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  expect(screen.getByRole("heading", { name: "Предложить точку" })).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText("Например, городской фестиваль"), "Festival");
  await user.selectOptions(screen.getByRole("combobox", { name: /Категория/ }), "1");
  await user.type(screen.getByPlaceholderText(/Расскажите, почему/), "Description");
  await user.type(screen.getByLabelText(/Дата и время события/), "2026-12-01T12:00");
  await user.type(screen.getByPlaceholderText("Как к вам обращаться"), "Author");
  await user.click(screen.getByRole("button", { name: "Отправить заявку" }));

  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(api).toHaveBeenCalledWith("/point-requests", {
    method: "POST",
    body: JSON.stringify({
      author_name: "Author",
      title: "Festival",
      description: "Description",
      category_id: 1,
      latitude: 51.533,
      longitude: 46.034,
      event_at: new Date("2026-12-01T12:00").toISOString(),
    }),
  });
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Предложить точку" })).not.toBeInTheDocument());
});

it("shows selected point card and closes it", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "select" }));
  expect(screen.getByRole("heading", { name: "Event" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Закрыть карточку" }));
  expect(screen.queryByRole("heading", { name: "Event" })).not.toBeInTheDocument();
});
