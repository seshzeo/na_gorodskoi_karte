import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, ModeratorPoint, Page } from "../../entities";
import { api } from "../../shared/api";

type PointStatus = "active" | "archived" | "all";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ModeratorPointsPanel({ categories }: { categories: Category[] }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PointStatus>("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const pointsQuery = useQuery({
    queryKey: ["moderator", "points", status],
    queryFn: () => api<Page<ModeratorPoint>>(`/moderator/points?status=${status}&limit=100&offset=0`),
  });
  const points = pointsQuery.data?.items ?? [];
  const selected = points.find((point) => point.id === selectedId) ?? null;
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    latitude: "",
    longitude: "",
    event_at: "",
  });
  const update = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No point selected");
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: Number(form.category_id),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      };
      if (selected.point_type === "event") payload.event_at = new Date(form.event_at).toISOString();
      return api<ModeratorPoint>(`/moderator/points/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderator", "points"] });
      await queryClient.invalidateQueries({ queryKey: ["points"] });
    },
  });
  const archive = useMutation({
    mutationFn: (point: ModeratorPoint) => api<void>(`/moderator/points/${point.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["moderator", "points"] });
      await queryClient.invalidateQueries({ queryKey: ["points"] });
    },
  });
  const restore = useMutation({
    mutationFn: (point: ModeratorPoint) => api<ModeratorPoint>(`/moderator/points/${point.id}/restore`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["moderator", "points"] });
      await queryClient.invalidateQueries({ queryKey: ["points"] });
    },
  });

  function selectPoint(point: ModeratorPoint) {
    setSelectedId(point.id);
    setForm({
      title: point.title,
      description: point.description,
      category_id: String(point.category_id),
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      event_at: toLocalInput(point.event_at),
    });
  }

  return (
    <section className="auth-panel moderator-points-panel">
      <div className="auth-panel-heading">
        <span className="page-kicker">Каталог карты</span>
        <h2>Опубликованные точки</h2>
        <p>Редактирование содержимого, архивирование и восстановление точек.</p>
      </div>
      <div className="request-filters" aria-label="Статус точек">
        {(["active", "archived", "all"] as const).map((value) => (
          <button key={value} type="button" className={status === value ? "request-filter active" : "request-filter"} onClick={() => { setStatus(value); setSelectedId(null); }}>
            {value === "active" ? "На карте" : value === "archived" ? "В архиве" : "Все"}
          </button>
        ))}
        <button type="button" className="request-refresh" onClick={() => void pointsQuery.refetch()} disabled={pointsQuery.isFetching}>↻ Обновить</button>
      </div>
      {pointsQuery.isLoading && <div className="request-state" role="status">Загрузка точек…</div>}
      {pointsQuery.isError && <div className="form-error" role="alert">Не удалось загрузить точки.</div>}
      {!pointsQuery.isLoading && !pointsQuery.isError && points.length === 0 && <div className="request-state">Точек в этом разделе пока нет.</div>}
      <div className="request-workspace">
        <div className="request-list" aria-label="Опубликованные точки">
          {points.map((point) => (
            <button key={point.id} type="button" className={selected?.id === point.id ? "request-list-item selected" : "request-list-item"} onClick={() => selectPoint(point)}>
              <span className={point.is_active ? "request-status-dot approved" : "request-status-dot rejected"} />
              <span className="request-list-copy">
                <strong>{point.title}</strong>
                <small>{point.point_type === "permanent" ? "Постоянно" : point.event_at ? new Date(point.event_at).toLocaleString("ru-RU") : "Дата не указана"}</small>
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <form className="request-detail" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
            <div className="request-detail-top"><strong>{selected.point_type === "permanent" ? "Постоянное место" : "Событие"}</strong><span className="request-id">Точка №{selected.id}</span></div>
            <label className="form-field"><span>Название</span><input required maxLength={200} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="form-field"><span>Описание</span><textarea required value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="form-field"><span>Категория</span><select required value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <div className="coordinate-grid">
              <label className="form-field"><span>Широта</span><input required type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} /></label>
              <label className="form-field"><span>Долгота</span><input required type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} /></label>
            </div>
            {selected.point_type === "event" && <label className="form-field"><span>Дата и время начала</span><input required type="datetime-local" value={form.event_at} onChange={(event) => setForm((current) => ({ ...current, event_at: event.target.value }))} /></label>}
            {update.isError && <p className="form-error" role="alert">Не удалось сохранить изменения.</p>}
            <div className="dialog-footer">
              <button className="button button-primary" type="submit" disabled={update.isPending}>{update.isPending ? "Сохраняем…" : "Сохранить"}</button>
              {selected.is_active
                ? <button className="button button-danger" type="button" disabled={archive.isPending} onClick={() => archive.mutate(selected)}>В архив</button>
                : <button className="button button-secondary" type="button" disabled={restore.isPending} onClick={() => restore.mutate(selected)}>Восстановить</button>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
