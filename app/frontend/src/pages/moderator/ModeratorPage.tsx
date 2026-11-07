import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "../../entities/category/model/useCategories";
import { useModeratePointRequest, usePointRequests, type RequestFilter } from "../../features/moderation/model/usePointRequests";
import { ApiError } from "../../shared/api";
import { useAuthStore } from "../../features/auth/model/authStore";
import type { Category, Point, PointRequestRead } from "../../entities";
import { ModeratorPointsPanel } from "./ModeratorPointsPanel";
import { api } from "../../shared/api";

const filters: { value: RequestFilter; label: string }[] = [
  { value: "pending", label: "Новые" },
  { value: "approved", label: "Одобренные" },
  { value: "rejected", label: "Отклонённые" },
  { value: "all", label: "Все" },
];

const statusLabels: Record<PointRequestRead["status"], string> = {
  pending: "Ожидает проверки",
  approved: "Одобрена",
  rejected: "Отклонена",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ModeratorPage() {
  const moderator = useAuthStore((state) => state.moderator);
  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const initialize = useAuthStore((state) => state.initialize);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPermanentForm, setShowPermanentForm] = useState(false);
  const [showPointsPanel, setShowPointsPanel] = useState(false);

  const requestsQuery = usePointRequests(filter);
  const categoriesQuery = useCategories();
  const moderation = useModeratePointRequest();
  const requests = requestsQuery.data?.items ?? [];
  const selected = requests.find((item) => item.id === selectedId) ?? requests[0] ?? null;
  const categoryName = (id: number) => categoriesQuery.data?.find((item) => item.id === id)?.name ?? `Категория #${id}`;

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

  async function handleApprove(id: number) {
    setActionError(null);
    try {
      await moderation.mutateAsync({ id, action: "approve" });
      setSelectedId(null);
    } catch (error) {
      setActionError(error instanceof ApiError && typeof error.detail === "string"
        ? error.detail
        : "Не удалось одобрить заявку. Обновите список и попробуйте снова.");
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setActionError(null);
    try {
      await moderation.mutateAsync({ id: selected.id, action: "reject", reason: rejectionReason.trim() });
      setRejectionReason("");
      setSelectedId(null);
    } catch (error) {
      setActionError(error instanceof ApiError && typeof error.detail === "string"
        ? error.detail
        : "Не удалось отклонить заявку. Обновите список и попробуйте снова.");
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

      {authStatus === "loading" && (
        <div className="auth-panel" role="status">Проверяем сессию модератора…</div>
      )}

      {authStatus === "error" && (
        <div className="auth-panel">
          <h2>Не удалось проверить сессию</h2>
          <p className="form-error" role="alert">{authError}</p>
          <button className="button button-primary" onClick={() => void initialize()}>Повторить</button>
        </div>
      )}

      {authStatus === "unauthenticated" && (
        <div className="auth-panel auth-login-panel">
          <div className="auth-panel-heading">
            <span className="page-kicker">Защищённый доступ</span>
            <h2>Вход для модератора</h2>
            <p>Введите учётные данные, выданные администратором сервиса.</p>
          </div>
          <form className="auth-form" onSubmit={handleLogin}>
            <label className="form-field">
              <span>Логин</span>
              <input autoComplete="username" required maxLength={120} value={username}
                onChange={(event) => setUsername(event.target.value)} placeholder="Логин модератора" />
            </label>
            <label className="form-field">
              <span>Пароль</span>
              <input type="password" autoComplete="current-password" required value={password}
                onChange={(event) => setPassword(event.target.value)} placeholder="Пароль" />
            </label>
            {authError && <div className="form-error" role="alert">{authError}</div>}
            <button className="button button-primary auth-submit" disabled={submitting}>
              {submitting ? "Входим…" : "Войти"}
            </button>
          </form>
        </div>
      )}

      {authStatus === "authenticated" && moderator && (
        <div className="moderator-layout">
          <nav className="moderator-nav">
            <div className="moderator-nav-title">Рабочая область</div>
            <div className="moderator-nav-items">
              <div className="moderator-nav-item active">▤ <span>Заявки</span></div>
              <button type="button" className="moderator-nav-item" onClick={() => setShowPointsPanel((value) => !value)}>⌖ <span>Опубликованные точки</span></button>
              <div className="moderator-nav-item disabled">◇ <span>Категории</span><small>Скоро</small></div>
            </div>
            <div className="moderator-account">
              <span>Вы вошли как</span>
              <strong>{moderator.username}</strong>
              <button className="button button-secondary" onClick={() => void handleLogout()}>Выйти</button>
              {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
            </div>
          </nav>

          <div className="moderator-content">
            <div className="moderator-panel-heading">
              <div><h2>Очередь заявок</h2><p>Новые предложения от посетителей городской карты.</p></div>
              <span className="status-pill pending">{requestsQuery.isLoading ? "Загрузка…" : `Заявок: ${requestsQuery.data?.total ?? 0}`}</span>
            </div>

            <div className="request-filters" role="tablist" aria-label="Фильтр заявок">
              {filters.map((item) => (
                <button key={item.value} type="button" role="tab" aria-selected={filter === item.value}
                  className={filter === item.value ? "request-filter active" : "request-filter"}
                  onClick={() => { setFilter(item.value); setSelectedId(null); setActionError(null); }}>
                  {item.label}
                </button>
              ))}
              <button className="request-refresh" type="button" onClick={() => void requestsQuery.refetch()}
                disabled={requestsQuery.isFetching}>↻ Обновить</button>
            </div>

            {requestsQuery.isLoading && <div className="request-state" role="status">Загружаем заявки…</div>}
            {requestsQuery.isError && (
              <div className="request-state request-state-error" role="alert">
                <strong>Не удалось загрузить заявки</strong>
                <p>{requestsQuery.error instanceof ApiError && requestsQuery.error.status === 401
                  ? "Сессия истекла. Выйдите и войдите снова."
                  : "Проверьте соединение с сервером и повторите запрос."}</p>
                <button className="button button-secondary" onClick={() => void requestsQuery.refetch()}>Повторить</button>
              </div>
            )}
            {!requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0 && (
              <div className="request-state">
                <div className="empty-icon">✓</div>
                <strong>Заявок в этой категории пока нет</strong>
                <p>Выберите другой фильтр или обновите список позже.</p>
              </div>
            )}

            {!requestsQuery.isLoading && !requestsQuery.isError && requests.length > 0 && (
              <div className="request-workspace">
                <div className="request-list" aria-label="Список заявок">
                  {requests.map((request) => (
                    <button key={request.id} type="button"
                      className={selected?.id === request.id ? "request-list-item selected" : "request-list-item"}
                      onClick={() => { setSelectedId(request.id); setActionError(null); setRejectionReason(""); }}>
                      <span className={`request-status-dot ${request.status}`} />
                      <span className="request-list-copy">
                        <strong>{request.title}</strong>
                        <small>{request.author_name} · {formatDate(request.created_at)}</small>
                      </span>
                      <span className={`request-status-label ${request.status}`}>{statusLabels[request.status]}</span>
                    </button>
                  ))}
                </div>

                {selected && (
                  <article className="request-detail">
                    <div className="request-detail-top">
                      <span className={`request-status-label ${selected.status}`}>{statusLabels[selected.status]}</span>
                      <span className="request-id">Заявка №{selected.id}</span>
                    </div>
                    <h3>{selected.title}</h3>
                    <p className="request-description">{selected.description}</p>
                    <dl className="request-meta">
                      <div><dt>Категория</dt><dd>{categoryName(selected.category_id)}</dd></div>
                      <div><dt>Автор</dt><dd>{selected.author_name}</dd></div>
                      <div><dt>Дата события</dt><dd>{formatDate(selected.event_at)}</dd></div>
                      <div><dt>Получена</dt><dd>{formatDate(selected.created_at)}</dd></div>
                      <div><dt>Координаты</dt><dd>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</dd></div>
                      {selected.point_id !== null && <div><dt>Созданная точка</dt><dd>№{selected.point_id}</dd></div>}
                      {selected.moderated_at && <div><dt>Обработана</dt><dd>{formatDate(selected.moderated_at)}</dd></div>}
                    </dl>
                    {selected.rejection_reason && (
                      <div className="request-rejection"><strong>Причина отклонения</strong><p>{selected.rejection_reason}</p></div>
                    )}
                    {selected.status === "pending" && (
                      <div className="request-actions">
                        <button className="button button-primary" disabled={moderation.isPending}
                          onClick={() => void handleApprove(selected.id)}>
                          {moderation.isPending ? "Обрабатываем…" : "Одобрить заявку"}
                        </button>
                        <form className="request-reject-form" onSubmit={handleReject}>
                          <label className="form-field">
                            <span>Причина отклонения</span>
                            <textarea required maxLength={500} rows={3} value={rejectionReason}
                              onChange={(event) => setRejectionReason(event.target.value)}
                              placeholder="Кратко объясните автору причину отказа" />
                          </label>
                          <button className="button button-danger" type="submit"
                            disabled={moderation.isPending || !rejectionReason.trim()}>
                            Отклонить заявку
                          </button>
                        </form>
                      </div>
                    )}
                    {actionError && <p className="form-error" role="alert">{actionError}</p>}
                  </article>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


function CreatePermanentPlaceForm({
  categories,
  authorName,
  onCreated,
}: {
  categories: Category[];
  authorName: string;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    latitude: "",
    longitude: "",
  });
  const mutation = useMutation({
    mutationFn: () => api<Point>("/moderator/points", {
      method: "POST",
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: Number(form.category_id),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        point_type: "permanent",
        event_at: null,
        author_name: authorName,
      }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["points"] });
      setForm({ title: "", description: "", category_id: "", latitude: "", longitude: "" });
      onCreated();
    },
  });

  return (
    <form className="auth-panel" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <div className="auth-panel-heading">
        <span className="page-kicker">Публикация модератора</span>
        <h2>Новое постоянное место</h2>
        <p>Для постоянных мест дата и время не указываются.</p>
      </div>
      <div className="form-grid">
        <label className="form-field">
          <span>Название</span>
          <input required maxLength={200} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Категория</span>
          <select required value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}>
            <option value="">Выберите категорию</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="form-field form-field-wide">
          <span>Описание</span>
          <textarea required maxLength={5000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Широта</span>
          <input required type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Долгота</span>
          <input required type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} />
        </label>
      </div>
      {mutation.isError && <p className="form-error" role="alert">Не удалось создать место. Проверьте данные и повторите попытку.</p>}
      <div className="dialog-footer">
        <button type="submit" className="button button-primary" disabled={mutation.isPending || !form.category_id}>
          {mutation.isPending ? "Сохраняем…" : "Опубликовать место"}
        </button>
      </div>
    </form>
  );
}
