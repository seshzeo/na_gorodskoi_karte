import { useState, type ReactNode } from "react";
import type { Category } from "../entities";
import { useTheme } from "../app/theme/ThemeProvider";

type Props = {
  children: ReactNode;
  active: "map" | "moderator";
  categories?: Category[];
  categoryId?: number;
  onCategoryChange?: (id?: number) => void;
  onAddPoint?: () => void;
};

export function AppShell({ children, active, categories = [], categoryId, onCategoryChange, onAddPoint }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { preference, resolvedTheme, setPreference } = useTheme();

  const themeLabel = preference === "system" ? "Авто" : preference === "light" ? "Светлая" : "Тёмная";
  const cycleTheme = () => setPreference(preference === "system" ? "light" : preference === "light" ? "dark" : "system");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">☰</button>
        <a className="brand" href="/" aria-label="На городской карте — главная">
          <span className="brand-symbol">⌖</span>
          <span><strong>На городской карте</strong><small>Городские места и события</small></span>
        </a>
        <div className="topbar-actions">
          <button className="theme-button" onClick={cycleTheme} title={`Тема: ${themeLabel}. Нажмите, чтобы изменить`}>
            <span>{resolvedTheme === "dark" ? "☾" : "☀"}</span><span className="theme-label">{themeLabel}</span>
          </button>
          {active === "map" && <button className="button button-primary header-add" onClick={onAddPoint}>＋ <span>Добавить точку</span></button>}
        </div>
      </header>

      {mobileOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
      <div className="app-body">
        <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
          <div className="sidebar-topline">
            {!collapsed && <span className="eyebrow">НАВИГАЦИЯ</span>}
            <button className="icon-button collapse-button" onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }} aria-label="Свернуть или раскрыть меню">{collapsed ? "⇥" : "⇤"}</button>
            <button className="icon-button mobile-close-button" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню">×</button>
          </div>
          <nav className="nav-list">
            <a className={`nav-item ${active === "map" ? "active" : ""}`} href="/">
              <span className="nav-icon">⌖</span><span className="nav-text">Карта города</span>
            </a>
            <a className={`nav-item ${active === "moderator" ? "active" : ""}`} href="/moderator">
              <span className="nav-icon">▤</span><span className="nav-text">Модерация</span>
            </a>
          </nav>
          {active === "map" && <section className="sidebar-section">
            <div className="section-heading"><span className="eyebrow">КАТЕГОРИИ</span></div>
            <button className={`category-item ${categoryId === undefined ? "selected" : ""}`} onClick={() => { onCategoryChange?.(undefined); setMobileOpen(false); }}>
              <span className="category-dot all-dot" /><span className="nav-text">Все категории</span>
            </button>
            {categories.map((category, index) => <button key={category.id} className={`category-item ${categoryId === category.id ? "selected" : ""}`} onClick={() => { onCategoryChange?.(category.id); setMobileOpen(false); }}>
              <span className={`category-dot category-color-${index % 6}`} /><span className="nav-text">{category.name}</span>
            </button>)}
          </section>}
          <div className="sidebar-bottom">
            <span className="sidebar-caption">Открытая городская карта</span>
          </div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
