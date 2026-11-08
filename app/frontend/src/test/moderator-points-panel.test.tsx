import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModeratorPointsPanel } from "../pages/moderator/ModeratorPointsPanel";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../shared/api", () => ({ api: mocks.api }));

const categories = [
  { id: 1, name: "Parks", slug: "parks", is_active: true, is_builtin: true },
];

function makePoint(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    title: "Community event",
    description: "An event description",
    category_id: 1,
    category_name: "Parks",
    latitude: 51.5,
    longitude: 46,
    point_type: "event",
    event_at: "2026-01-02T12:30:00Z",
    author_name: "admin",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
    is_active: true,
    ...overrides,
  };
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ModeratorPointsPanel categories={categories} />
      </QueryClientProvider>,
    ),
  };
}

describe("ModeratorPointsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.mockResolvedValue({
      items: [makePoint()],
      total: 1,
      limit: 100,
      offset: 0,
    });
  });

  it("loads and edits an event, then invalidates point queries", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPanel();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    expect(await screen.findByText("Community event")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/moderator/points?status=active&limit=100&offset=0",
    );
    await user.click(screen.getByRole("button", { name: /Community event/ }));
    expect(screen.getByRole("textbox", { name: "Название" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Описание" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Категория" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Широта" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Долгота" })).toBeInTheDocument();
    expect(screen.getByLabelText("Дата и время начала")).toHaveValue(
      (() => {
        const date = new Date("2026-01-02T12:30:00Z");
        return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16);
      })(),
    );

    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Updated event");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(mocks.api).toHaveBeenCalledWith(
        "/moderator/points/21",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"title":"Updated event"'),
        }),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["moderator", "points"],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["points"],
      });
    });
  });

  it("archives an active point and refreshes the point queries", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPanel();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    await user.click(await screen.findByRole("button", { name: /Community event/ }));
    await user.click(screen.getByRole("button", { name: "В архив" }));

    await waitFor(() => {
      expect(mocks.api).toHaveBeenCalledWith(
        "/moderator/points/21",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["moderator", "points"],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["points"],
      });
    });
  });

  it("restores an archived point and supports status filters and refresh", async () => {
    const user = userEvent.setup();
    const archivedPoint = makePoint({ is_active: false });
    mocks.api.mockImplementation((url: string) =>
      Promise.resolve({
        items: [url.includes("status=archived") ? archivedPoint : makePoint()],
        total: 1,
        limit: 100,
        offset: 0,
      }),
    );
    renderPanel();

    await user.click(screen.getByRole("button", { name: "В архиве" }));
    await user.click(await screen.findByRole("button", { name: /Community event/ }));
    await user.click(screen.getByRole("button", { name: "Восстановить" }));

    await waitFor(() => {
      expect(mocks.api).toHaveBeenCalledWith(
        "/moderator/points/21/restore",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Все" }));
    await user.click(screen.getByRole("button", { name: "↻ Обновить" }));
    expect(mocks.api).toHaveBeenCalledWith(
      "/moderator/points?status=all&limit=100&offset=0",
    );
  });

  it("does not render an event date field for permanent points", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValue({
      items: [makePoint({ point_type: "permanent", event_at: null })],
      total: 1,
      limit: 100,
      offset: 0,
    });
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /Community event/ }));

    expect(screen.queryByLabelText("Дата и время начала")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });

  it("shows a clear error when saving a point fails", async () => {
    const user = userEvent.setup();
    mocks.api
      .mockResolvedValueOnce({
        items: [makePoint()],
        total: 1,
        limit: 100,
        offset: 0,
      })
      .mockRejectedValueOnce(new Error("Network failure"));
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /Community event/ }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось сохранить изменения.",
    );
  });
});
