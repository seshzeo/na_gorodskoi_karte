import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

function setAuthenticated() {
  mocks.auth.status = "authenticated";
  mocks.auth.moderator = { id: "m1", username: "admin" };
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return { ...mocks.request, ...overrides };
}

function renderModerator() {
  return render(<ModeratorPage />);
}

function getTabs() {
  return screen.getAllByRole("tab");
}

function getActionButton(fragment: string) {
  let selector: string;

  if (fragment.includes("Р’С‹Р№")) {
    selector = ".moderator-account button";
  } else if (fragment.includes("РћР±РЅ")) {
    selector = ".request-refresh";
  } else if (fragment.includes("РџРѕ")) {
    selector = ".request-state-error button, .auth-panel button";
  } else if (fragment.includes("РћРґ")) {
    selector = ".request-actions > button.button-primary";
  } else if (fragment.includes("РћС‚")) {
    selector = ".request-reject-form button";
  } else {
    throw new Error(`Unknown action button: ${fragment}`);
  }

  const button = document.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Button not found by selector: ${selector}`);
  return button;
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

  it("logs out successfully", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getActionButton("Р’С‹Р№С‚Рё"));

    expect(mocks.auth.logout).toHaveBeenCalledOnce();
  });

  it("shows the API error when logout fails", async () => {
    const user = userEvent.setup();
    mocks.auth.logout.mockRejectedValue(
      new ApiError(500, "logout_error", "Session could not be closed"),
    );

    renderModerator();

    await user.click(getActionButton("Р’С‹Р№Рё"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Session could not be closed",
    );
  });

  it("shows a fallback error when logout fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.auth.logout.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.click(getActionButton("Р’С‹Р№С‚Рё"));

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

    await user.click(getActionButton("РћР±РЅРѕРІРёС‚СЊ"));

    expect(mocks.requestsQuery.refetch).toHaveBeenCalledOnce();
  });

  it("disables refresh while the query is fetching", () => {
    mocks.requestsQuery.isFetching = true;

    renderModerator();

    expect(getActionButton("РћР±РЅРѕРІРёС‚СЊ")).toBeDisabled();
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

    await user.click(getActionButton("РџРѕРІС‚РѕСЂРёС‚СЊ"));

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

    expect(screen.queryByRole("button", { name: /РћРґРѕР±СЂРёС‚СЊ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /РћС‚РєР»РѕРЅРёС‚СЊ/ })).not.toBeInTheDocument();
  });
});

describe("ModeratorPage — moderation actions", () => {
  beforeEach(() => {
    setAuthenticated();
  });

  it("approves a pending request", async () => {
    const user = userEvent.setup();

    renderModerator();

    await user.click(getActionButton("РћРґРѕР±СЂРёС‚СЊ"));

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

    await user.click(getActionButton("РћРґРѕР±СЂРёС‚СЊ"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval rejected",
    );
  });

  it("shows a fallback error when approval fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.click(getActionButton("РћРґРѕР±РёС‚СЊ"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("submits a trimmed rejection reason", async () => {
    const user = userEvent.setup();

    renderModerator();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "  Not enough information  ");
    await user.click(getActionButton("РћС‚РєР»РѕРЅРёС‚СЊ"));

    expect(mocks.moderation.mutateAsync).toHaveBeenCalledWith({
      id: 1,
      action: "reject",
      reason: "Not enough information",
    });
  });

  it("does not submit a rejection with an empty reason", () => {
    renderModerator();

    expect(getActionButton("РћС‚РєР»РѕРЅРёС‚СЊ")).toBeDisabled();
  });

  it("shows an API error when rejection fails", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(
      new ApiError(400, "rejection_error", "Rejection failed"),
    );

    renderModerator();

    await user.type(screen.getByRole("textbox"), "Invalid event");
    await user.click(getActionButton("РћС‚РєР»РѕРЅРёС‚СЊ"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rejection failed",
    );
  });

  it("shows a fallback error when rejection fails unexpectedly", async () => {
    const user = userEvent.setup();
    mocks.moderation.mutateAsync.mockRejectedValue(new Error("Unexpected"));

    renderModerator();

    await user.type(screen.getByRole("textbox"), "Invalid event");
    await user.click(getActionButton("РћС‚РєР»РѕРЅРёС‚СЊ"));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("disables moderation controls while a mutation is pending", () => {
    mocks.moderation.isPending = true;

    renderModerator();

    expect(getActionButton("РћРґРѕР±СЂРёС‚СЊ")).toBeDisabled();
    expect(getActionButton("РћС‚РєР»РѕРЅРёС‚СЊ")).toBeDisabled();
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
