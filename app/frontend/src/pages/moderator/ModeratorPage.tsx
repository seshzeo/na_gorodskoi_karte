import { useState, type FormEvent } from "react";
import { ApiError } from "../../shared/api";
import { useAuthStore } from "../../features/auth/model/authStore";

export function ModeratorPage() {
  const moderator = useAuthStore((state) => state.moderator);
  const status = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const initialize = useAuthStore((state) => state.initialize);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      setPassword("");
    } catch {
      // The store exposes a user-facing authentication error.
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      setPassword("");
    } catch (error) {
      setLogoutError(error instanceof ApiError && typeof error.detail === "string"
        ? error.detail
        : "Не удалось завершить сессию. Попробуйте ещё раз.");
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="page-kicker">Управление сервисом</span>
          <h1>Кабинет модератора</h1>
          <p>Проверка предложенных точек и управление содержимым городской карты.</p>
        </div>
        <span className="workspace-icon">▣</span>
      </div>

      {status === "loading" && (
        <div className="auth-panel" role="status">Проверяем сессию модератора…</div>
      )}

      {status === "error" && (
        <div className="auth-panel">
          <h2>Не удалось проверить сессию</h2>
          <p className="auth-error" role="alert">{authError}</p>
          <button className="button button-primary" onClick={() => void initialize()}>Повторить</button>
        </div>
      )}

      {status === "unauthenticated" && (
        <div className="auth-panel auth-login-panel">
          <div className="auth-panel-heading">
            <span className="page-kicker">Защищённый доступ</span>
            <h2>Вход для модератора</h2>
            <p>Введите учётные данные, выданные администратором сервиса.</p>
          </div>
          <form className="auth-form" onSubmit={handleLogin}>
            <label className="form-field">
              <span>Логин</span>
              <input
                autoComplete="username"
                required
                maxLength={120}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Логин модератора"
              />
            </label>
            <label className="form-field">
              <span>Пароль</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Пароль"
              />
            </label>
            {authError && <div className="form-error" role="alert">{authError}</div>}
            <button className="button button-primary auth-submit" disabled={submitting}>
              {submitting ? "Входим…" : "Войти"}
            </button>
          </form>
        </div>
      )}

      {status === "authenticated" && moderator && (
        <div className="moderator-layout">
          <nav className="moderator-nav">
            <div className="moderator-nav-title">Рабочая область</div>
            <div className="moderator-nav-item active">▤ <span>Заявки</span></div>
            <div className="moderator-nav-item disabled">⌖ <span>Опубликованные точки</span><small>Скоро</small></div>
            <div className="moderator-nav-item disabled">◇ <span>Категории</span><small>Скоро</small></div>
            <div className="moderator-account">
              <span>Вы вошли как</span>
              <strong>{moderator.username}</strong>
              <button className="button button-secondary" onClick={() => void handleLogout()}>Выйти</button>
              {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
            </div>
          </nav>
          <div className="moderator-content">
            <div className="moderator-panel-heading">
              <div><h2>Очередь заявок</h2><p>Новые предложения от посетителей карты.</p></div>
              <span className="status-pill pending">API подключается</span>
            </div>
            <div className="moderator-empty">
              <div className="empty-icon">▤</div>
              <h3>Авторизация работает</h3>
              <p>Сессия модератора восстановлена и защищена CSRF-токеном. Следующим этапом подключим список заявок и действия модерации.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
