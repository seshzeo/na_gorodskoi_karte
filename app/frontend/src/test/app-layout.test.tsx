import { beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { CityProvider } from "../shared/city/CityProvider";
import { AppLayout } from "../widgets/AppLayout";

beforeEach(() => {
  localStorage.clear();
});

it("renders navigation and toggles sidebar and theme", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><CityProvider><ThemeProvider><AppLayout /></ThemeProvider></CityProvider></MemoryRouter>);
  expect(screen.getByText("На городской карте")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Карта/ })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Свернуть меню" }));
  expect(screen.getByRole("button", { name: "Развернуть меню" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Авто" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  expect(document.querySelector(".app-sidebar")?.className).toContain("mobile-open");
});


it("cycles through all theme modes", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter>
      <CityProvider><ThemeProvider>
        <AppLayout />
      </ThemeProvider></CityProvider>
    </MemoryRouter>,
  );

  const themeButton = () => screen.getByRole("button", {
    name: /Авто|Светлая|Тёмная/,
  });

  await user.click(themeButton());
  expect(screen.getByRole("button", { name: "Светлая" })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");

  await user.click(themeButton());
  expect(screen.getByRole("button", { name: "Тёмная" })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("dark");

  await user.click(themeButton());
  expect(screen.getByRole("button", { name: "Авто" })).toBeInTheDocument();
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("closes mobile navigation through backdrop and close button", async () => {
  const user = userEvent.setup();

  const { container } = render(
    <MemoryRouter>
      <CityProvider><ThemeProvider>
        <AppLayout />
      </ThemeProvider></CityProvider>
    </MemoryRouter>,
  );

  const sidebar = container.querySelector(".app-sidebar");
  const backdrop = container.querySelector(".sidebar-backdrop");

  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  expect(sidebar).toHaveClass("mobile-open");
  expect(backdrop).toHaveClass("visible");

  await user.click(backdrop!);
  expect(sidebar).not.toHaveClass("mobile-open");
  expect(backdrop).not.toHaveClass("visible");

  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  expect(sidebar).toHaveClass("mobile-open");

  await user.click(screen.getByRole("button", { name: "Закрыть меню" }));
  expect(sidebar).not.toHaveClass("mobile-open");
});

it("closes mobile navigation after selecting a route or the brand", async () => {
  const user = userEvent.setup();

  const { container } = render(
    <MemoryRouter>
      <CityProvider><ThemeProvider>
        <AppLayout />
      </ThemeProvider></CityProvider>
    </MemoryRouter>,
  );

  const sidebar = container.querySelector(".app-sidebar");

  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  await user.click(screen.getByRole("link", { name: /Кабинет модератора/ }));
  expect(sidebar).not.toHaveClass("mobile-open");

  await user.click(screen.getByRole("button", { name: "Открыть меню" }));
  await user.click(screen.getByRole("link", { name: /На городской карте/ }));
  expect(sidebar).not.toHaveClass("mobile-open");
});

it("can collapse and expand the sidebar repeatedly", async () => {
  const user = userEvent.setup();

  const { container } = render(
    <MemoryRouter>
      <CityProvider><ThemeProvider>
        <AppLayout />
      </ThemeProvider></CityProvider>
    </MemoryRouter>,
  );

  const sidebar = container.querySelector(".app-sidebar");

  await user.click(screen.getByRole("button", { name: "Свернуть меню" }));
  expect(sidebar).toHaveClass("collapsed");

  await user.click(screen.getByRole("button", { name: "Развернуть меню" }));
  expect(sidebar).not.toHaveClass("collapsed");
});
