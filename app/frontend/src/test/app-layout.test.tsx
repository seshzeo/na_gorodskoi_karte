import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { AppLayout } from "../widgets/AppLayout";

it("renders navigation and toggles sidebar and theme", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><ThemeProvider><AppLayout /></ThemeProvider></MemoryRouter>);
  expect(screen.getByText("На городской карте")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Карта/ })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Свернуть меню" }));
  expect(screen.getByRole("button", { name: "Развернуть меню" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Изменить тему" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  expect(document.querySelector(".app-sidebar")?.className).toContain("mobile-open");
});
