import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
  expect(screen.getByText("dark")).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

it("throws outside provider", () => {
  expect(() => render(<Probe />)).toThrow("useTheme must be used inside ThemeProvider");
});
