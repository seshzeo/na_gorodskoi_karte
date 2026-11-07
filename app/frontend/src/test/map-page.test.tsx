import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapPage } from "../pages/map/MapPage";
import { CityProvider } from "../shared/city/CityProvider";
import { api, ApiError } from "../shared/api";

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
  return render(<CityProvider><QueryClientProvider client={client}><MapPage /></QueryClientProvider></CityProvider>);
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


async function fillRequestForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Например, городской фестиваль"), "Festival");
  await user.selectOptions(screen.getByRole("combobox", { name: /Категория/ }), "1");
  await user.type(screen.getByPlaceholderText(/Расскажите, почему/), "Description");
  await user.type(screen.getByLabelText(/Дата и время события/), "2026-12-01T12:00");
  await user.type(screen.getByPlaceholderText("Как к вам обращаться"), "Author");
}

it("shows a server error when point request fails", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockReset().mockRejectedValueOnce(
    new ApiError(422, "validation_error", "Некорректные данные заявки"),
  );

  renderPage();
  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  await fillRequestForm(user);
  await user.click(screen.getByRole("button", { name: "Отправить заявку" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Некорректные данные заявки");
  expect(screen.getByRole("heading", { name: "Предложить точку" })).toBeInTheDocument();
});

it("shows a generic error when point request fails unexpectedly", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockReset().mockRejectedValueOnce(new Error("Network failure"));

  renderPage();
  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  await fillRequestForm(user);
  await user.click(screen.getByRole("button", { name: "Отправить заявку" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.",
  );
  expect(screen.getByRole("heading", { name: "Предложить точку" })).toBeInTheDocument();
});

it("does not allow submitting without a category", async () => {
  const user = userEvent.setup();
  vi.mocked(api).mockReset().mockResolvedValue({ id: 1 });

  renderPage();
  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));

  expect(screen.getByRole("button", { name: "Отправить заявку" })).toBeDisabled();
  expect(api).not.toHaveBeenCalled();
});

it("closes the request modal through cancel and close buttons", async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  await user.click(screen.getByRole("button", { name: "Отмена" }));
  expect(screen.queryByRole("heading", { name: "Предложить точку" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));
  await user.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(screen.queryByRole("heading", { name: "Предложить точку" })).not.toBeInTheDocument();
});

it("closes the request modal on backdrop but not on form interaction", async () => {
  const user = userEvent.setup();
  const { container } = renderPage();

  await user.click(screen.getByRole("button", { name: /Добавить точку/ }));

  const form = container.querySelector(".form-dialog");
  const backdrop = container.querySelector(".dialog-backdrop");

  expect(form).not.toBeNull();
  expect(backdrop).not.toBeNull();

  fireEvent.mouseDown(form!);
  expect(screen.getByRole("heading", { name: "Предложить точку" })).toBeInTheDocument();

  fireEvent.mouseDown(backdrop!);
  expect(screen.queryByRole("heading", { name: "Предложить точку" })).not.toBeInTheDocument();
});
