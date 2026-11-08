import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "../shared/theme/ThemeProvider";

function Probe() {
  const { mode, resolvedTheme, setMode } = useTheme();
  return <div><span>{mode}</span><span>{resolvedTheme}</span><button onClick={() => setMode("dark")}>dark</button></div>;
}

it("resolves and changes theme", async () => {
  const user = userEvent.setup();
  render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText("system")).toBeInTheDocument();
  expect(screen.getByText("light")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "dark" }));
  expect(screen.getByRole("button", { name: "dark" })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

it("throws outside provider", () => {
  expect(() => render(<Probe />)).toThrow("useTheme must be used inside ThemeProvider");
});


it("restores a saved dark theme from localStorage", () => {
  const getItem = vi.fn().mockReturnValue("dark");
  const setItem = vi.fn();

  vi.stubGlobal("localStorage", { getItem, setItem });

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  expect(getItem).toHaveBeenCalledWith("map-theme");
  expect(screen.getAllByText("dark", { selector: "span" })).toHaveLength(2);
  expect(document.documentElement.dataset.theme).toBe("dark");
});

it("falls back to system theme when the saved value is invalid", () => {
  vi.spyOn(localStorage, "getItem").mockReturnValue("invalid");

  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  expect(screen.getByText("system")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("updates the resolved theme when the system preference changes", async () => {
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  const removeEventListener = vi.fn();

  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: false,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") {
        changeListener = listener as (event: MediaQueryListEvent) => void;
      }
    },
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList);

  const { unmount } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

  expect(document.documentElement.dataset.theme).toBe("light");

  await act(async () => {
    changeListener?.({ matches: true } as MediaQueryListEvent);
  });

  expect(document.documentElement.dataset.theme).toBe("dark");

  unmount();

  expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
});

it("does not crash when localStorage is unavailable", () => {
  vi.spyOn(localStorage, "getItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });

  expect(() =>
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    ),
  ).not.toThrow();

  expect(document.documentElement.dataset.theme).toBe("light");
});
