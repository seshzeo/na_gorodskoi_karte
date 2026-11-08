import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { ApiError } from "../shared/api";
import { ModeratorPage } from "../pages/moderator/ModeratorPage";

const mocks = vi.hoisted(() => ({
  auth: {
    moderator: null as { id: string; username: string } | null,
    status: "unauthenticated",
    error: null as string | null,
    login: vi.fn(),
    logout: vi.fn(),
    initialize: vi.fn(),
  },
  request: {
    id: 1,
    author_name: "Ann",
    title: "City event",
    description: "An event description",
    category_id: 1,
    latitude: 51.5,
    longitude: 46,
    event_at: "2026-01-01T12:00:00Z",
    status: "pending",
    rejection_reason: null as string | null,
    point_id: null as number | null,
    moderated_at: null as string | null,
    created_at: "2026-01-01T10:00:00Z",
  },
  requestsQuery: {
    data: null as any,
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  moderation: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  api: vi.fn(),
  categoriesQuery: {
    data: [{ id: 1, name: "Parks", slug: "parks" }],
    isLoading: false,
  },
  lastFilter: "pending",
}));

vi.mock("../features/auth/model/authStore", () => ({
  useAuthStore: (selector: (state: typeof mocks.auth) => unknown) =>
    selector(mocks.auth),
}));

vi.mock("../features/moderation/model/usePointRequests", () => ({
  usePointRequests: (filter: string) => {
    mocks.lastFilter = filter;
    return mocks.requestsQuery;
  },
  useModeratePointRequest: () => mocks.moderation,
}));

vi.mock("../entities/category/model/useCategories", () => ({
  useCategories: () => mocks.categoriesQuery,
}));

vi.mock("../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/api")>();
  return { ...actual, api: mocks.api };
});

function setAuthenticated() {
  mocks.auth.status = "authenticated";
  mocks.auth.moderator = { id: "m1", username: "admin" };
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return { ...mocks.request, ...overrides };
}

function renderModerator() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ModeratorPage />
      </QueryClientProvider>,
    ),
  };
}

function makeModeratorPoint() {
  return {
    id: 21,
    title: "Community garden",
    description: "A permanent community garden",
    category_id: 1,
    category_name: "Parks",
    latitude: 51.5,
    longitude: 46,
    point_type: "permanent",
    event_at: null,
    author_name: "admin",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
    is_active: true,
  };
}

function getTabs() {
  return screen.getAllByRole("tab");
}

function getActionButton(action: "logout" | "refresh" | "retry" | "approve" | "reject") {
  const names = {
    logout: "Выйти",
    refresh: "↻ Обновить",
    retry: "Повторить",
    approve: "Одобрить заявку",
    reject: "Отклонить заявку",
  } as const;
  return screen.getByRole("button", { name: names[action] });
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.auth.moderator = null;
  mocks.auth.status = "unauthenticated";
  mocks.auth.error = null;
  mocks.auth.login.mockResolvedValue(undefined);
  mocks.auth.logout.mockResolvedValue(undefined);
  mocks.auth.initialize.mockResolvedValue(undefined);

  mocks.request = {
    id: 1,
    author_name: "Ann",
    title: "City event",
    description: "An event description",
    category_id: 1,
    latitude: 51.5,
    longitude: 46,
    event_at: "2026-01-01T12:00:00Z",
    status: "pending",
    rejection_reason: null,
    point_id: null,
    moderated_at: null,
    created_at: "2026-01-01T10:00:00Z",
  };

  mocks.requestsQuery.data = {
    items: [makeRequest()],
    total: 1,
  };
  mocks.requestsQuery.isLoading = false;
  mocks.requestsQuery.isError = false;
  mocks.requestsQuery.isFetching = false;
  mocks.requestsQuery.error = null;
  mocks.requestsQuery.refetch.mockResolvedValue(undefined);

  mocks.moderation.mutateAsync.mockResolvedValue({});
  mocks.moderation.isPending = false;
  mocks.api.mockResolvedValue({
    items: [makeModeratorPoint()],
    total: 1,
    limit: 100,
    offset: 0,
  });

  mocks.categoriesQuery.data = [
    { id: 1, name: "Parks", slug: "parks" },
  ];
  mocks.categoriesQuery.isLoading = false;
  mocks.lastFilter = "pending";
});

describe("ModeratorPage — authentication", () => {
  it("shows the login form when unauthenticated", () => {
    renderModerator();

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it("shows the loading state while authentication is checked", () => {
    mocks.auth.status = "loading";

    renderModerator();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an authentication error and retries initialization", async () => {
    const user = userEvent.setup();
    mocks.auth.status = "error";
    mocks.auth.error = "Authentication unavailable";

    renderModerator();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Authentication unavailable",
    );

    await user.click(screen.getByRole("button"));

    expect(mocks.auth.initialize).toHaveBeenCalledOnce();
  });

  it("trims the username and submits credentials", async () => {
    const user = userEvent.setup();

    renderModerator();

    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "  admin  ");
    await user.type(
      document.querySelector('input[type="password"]')!,
      "password",
    );
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mocks.auth.login).toHaveBeenCalledWith("admin", "password");
    });
  });

  it("keeps the password after a failed login and displays the store error", async () => {
    const user = userEvent.setup();
    mocks.auth.error = "Invalid credentials";
    mocks.auth.login.mockRejectedValue(new Error("Login failed"));

    renderModerator();

    await user.type(screen.getAllByRole("textbox")[0], "admin");
    const password = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await user.type(password, "wrong-password");
    await user.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials",
    );
    expect(password).toHaveValue("wrong-password");
  });
});

describe("ModeratorPage — authenticated workspace", () => {
  beforeEach(() => {
    setAuthenticated();
  });

  it("renders the moderator account and request workspace", () => {
    renderModerator();

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getAllByText("City event")).toHaveLength(2);
    expect(screen.getByText("An event description")).toBeInTheDocument();
  });

  it("opens and closes the published points panel and shows its content", async () => {
    const user = userEvent.setup();
    renderModerator();

    expect(screen.queryByText("Редактирование содержимого, архивирование и восстановление точек.")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Опубликованные точки/ });
    await user.click(toggle);

    expect(await screen.findByText("Community garden")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(screen.queryByText("Community garden")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the permanent-place form", async () => {
    const user = userEvent.setup();
    renderModerator();

    expect(screen.queryByRole("heading", { name: "Новое постоянное место" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Создать постоянное место/ });
    await user.click(toggle);

    expect(screen.getAllByRole("heading", { name: "Новое постоянное место" })).toHaveLength(2);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Закрыть форму" }));
    expect(screen.queryByRole("heading", { name: "Новое постоянное место" })).not.toBeInTheDocument();
  });

  it("creates a permanent place, invalidates the related queries, and closes the form", async () => {
    const user = userEvent.setup();
    mocks.api.mockResolvedValueOnce(makeModeratorPoint());
    const { queryClient } = renderModerator();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: /Создать постоянное место/ }));
    await user.type(screen.getByLabelText("Название"), "Garden");
    await user.selectOptions(screen.getByLabelText("Категория"), "1");
    await user.type(screen.getByLabelText("Описание"), "A quiet garden");
    await user.type(screen.getByLabelText("Широта"), "51.5");
    await user.type(screen.getByLabelText("Долгота"), "46");
    await user.click(screen.getByRole("button", { name: "Опубликовать место" }));

    await waitFor(() => {
      expect(mocks.api).toHaveBeenCalledWith(
        "/moderator/points",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"point_type":"permanent"'),
        }),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["moderator", "points"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["points"] });
    });
    expect(screen.queryByRole("heading", { name: "Новое постоянное место" })).not.toBeInTheDocument();
  });

  it("displays the API error when permanent-place creation fails", async () => {
    const user = userEvent.setup();
    mocks.api.mockRejectedValueOnce(new ApiError(422, "validation_error", "Category is unavailable"));
    renderModerator();

    await user.click(screen.getByRole("button", { name: /Создать постоянное место/ }));
    await user.type(screen.getByLabelText("Название"), "Garden");
    await user.selectOptions(screen.getByLabelText("Категория"), "1");
    await user.type(screen.getByLabelText("Описание"), "A quiet garden");
    await user.type(screen.getByLabelText("Широта"), "51.5");
    await user.type(screen.getByLabelText("Долгота"), "46");
    await user.click(screen.getByRole("button", { name: "Опубликовать место" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category is unavailable");
    expect(screen.getAllByRole("heading", { name: "Новое постоянное место" })).toHaveLength(2);
  });

  it("logs out successfully", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getActionButton("logout"));

    expect(mocks.auth.logout).toHaveBeenCalledOnce();
  });

  it("shows the API error when logout fails", async () => {
    const user = userEvent.setup();
    mocks.auth.logout.mockRejectedValue(
      new ApiError(500, "logout_error", "Session could not be closed"),
    );

    renderModerator();

    await user.click(getActionButton("logout"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session could not be closed",
    );
  });

  it("shows a fallback error when logout fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.auth.logout.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.click(getActionButton("logout"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("changes the request filter", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getTabs()[1]);

    expect(getTabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(mocks.lastFilter).toBe("approved");
  });

  it("resets the selected request when the filter changes", async () => {
    const user = userEvent.setup();
    mocks.requestsQuery.data = {
      items: [
        makeRequest({ id: 1, title: "First event" }),
        makeRequest({ id: 2, title: "Second event" }),
      ],
      total: 2,
    };

    renderModerator();

    await user.click(screen.getByRole("button", { name: /Second event/ }));
    expect(screen.getByRole("heading", { name: "Second event" })).toBeInTheDocument();

    await user.click(getTabs()[1]);

    expect(getTabs()[1]).toHaveAttribute("aria-selected", "true");
  });

  it("calls refetch when the refresh button is clicked", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getActionButton("refresh"));

    expect(mocks.requestsQuery.refetch).toHaveBeenCalledOnce();
  });

  it("disables refresh while the query is fetching", () => {
    mocks.requestsQuery.isFetching = true;

    renderModerator();

    expect(getActionButton("refresh")).toBeDisabled();
  });

  it("shows the request loading state", () => {
    mocks.requestsQuery.isLoading = true;

    renderModerator();

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("shows a special message for an expired session", () => {
    mocks.requestsQuery.isError = true;
    mocks.requestsQuery.error = new ApiError(401, "unauthorized", "Unauthorized");

    renderModerator();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows a generic message for other request errors", () => {
    mocks.requestsQuery.isError = true;
    mocks.requestsQuery.error = new Error("Network error");

    renderModerator();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retries loading after a request error", async () => {
    const user = userEvent.setup();
    mocks.requestsQuery.isError = true;
    mocks.requestsQuery.error = new Error("Network error");

    renderModerator();

    await user.click(getActionButton("retry"));

    expect(mocks.requestsQuery.refetch).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are no requests", () => {
    mocks.requestsQuery.data = { items: [], total: 0 };

    renderModerator();

    expect(document.querySelector(".request-list-item")).not.toBeInTheDocument();
    expect(document.querySelector(".request-state strong")).toBeInTheDocument();
  });

  it("selects another request and displays its details", async () => {
    const user = userEvent.setup();
    mocks.requestsQuery.data = {
      items: [
        makeRequest({ id: 1, title: "First event" }),
        makeRequest({ id: 2, title: "Second event", description: "Second description" }),
      ],
      total: 2,
    };

    renderModerator();

    await user.click(screen.getByRole("button", { name: /Second event/ }));

    expect(screen.getByRole("heading", { name: "Second event" })).toBeInTheDocument();
    expect(screen.getByText("Second description")).toBeInTheDocument();
  });

  it("uses the category name when the category exists", () => {
    renderModerator();

    expect(screen.getByText("Parks")).toBeInTheDocument();
  });

  it("shows a category fallback when the category is missing", () => {
    mocks.requestsQuery.data = {
      items: [makeRequest({ category_id: 999 })],
      total: 1,
    };
    mocks.categoriesQuery.data = [];

    renderModerator();

    expect(screen.getByText(/999/)).toBeInTheDocument();
  });

  it("renders linked point and moderation metadata when present", () => {
    mocks.requestsQuery.data = {
      items: [
        makeRequest({
          status: "approved",
          point_id: 42,
          moderated_at: "2026-01-02T12:00:00Z",
        }),
      ],
      total: 1,
    };

    renderModerator();

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("renders rejection reason for rejected requests", () => {
    mocks.requestsQuery.data = {
      items: [
        makeRequest({
          status: "rejected",
          rejection_reason: "Insufficient information",
        }),
      ],
      total: 1,
    };

    renderModerator();

    expect(screen.getByText("Insufficient information")).toBeInTheDocument();
  });

  it("does not show moderation actions for non-pending requests", () => {
    mocks.requestsQuery.data = {
      items: [makeRequest({ status: "approved" })],
      total: 1,
    };

    renderModerator();

    expect(screen.queryByRole("button", { name: "Одобрить заявку" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отклонить заявку" })).not.toBeInTheDocument();
  });
});

describe("ModeratorPage — moderation actions", () => {
  beforeEach(() => {
    setAuthenticated();
  });

  it("approves a pending request", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getActionButton("approve"));

    expect(mocks.moderation.mutateAsync).toHaveBeenCalledWith({
      id: 1,
      action: "approve",
    });
  });

  it("shows an API error when approval fails", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(
      new ApiError(400, "moderation_error", "Approval rejected"),
    );

    renderModerator();

    await user.click(getActionButton("approve"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval rejected",
    );
  });

  it("shows a fallback error when approval fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.click(getActionButton("approve"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("submits a trimmed rejection reason", async () => {
    const user = userEvent.setup();

    renderModerator();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "  Not enough information  ");
    await user.click(getActionButton("reject"));

    expect(mocks.moderation.mutateAsync).toHaveBeenCalledWith({
      id: 1,
      action: "reject",
      reason: "Not enough information",
    });
  });

  it("does not submit a rejection with an empty reason", () => {
    renderModerator();

    expect(getActionButton("reject")).toBeDisabled();
  });

  it("shows an API error when rejection fails", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(
      new ApiError(400, "rejection_error", "Rejection failed"),
    );

    renderModerator();

    await user.type(screen.getByRole("textbox"), "Invalid event");
    await user.click(getActionButton("reject"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rejection failed",
    );
  });

  it("shows a fallback error when rejection fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.type(screen.getByRole("textbox"), "Invalid event");
    await user.click(getActionButton("reject"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("disables moderation controls while a mutation is pending", () => {
    mocks.moderation.isPending = true;

    renderModerator();

    expect(screen.getByRole("button", { name: "Обрабатываем…" })).toBeDisabled();
    expect(getActionButton("reject")).toBeDisabled();
  });

  it("clears the rejection reason when another request is selected", async () => {
    const user = userEvent.setup();
    mocks.requestsQuery.data = {
      items: [
        makeRequest({ id: 1, title: "First event" }),
        makeRequest({ id: 2, title: "Second event" }),
      ],
      total: 2,
    };

    renderModerator();

    await user.type(screen.getByRole("textbox"), "Temporary reason");
    await user.click(screen.getByRole("button", { name: /Second event/ }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
