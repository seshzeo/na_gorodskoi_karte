export function ModeratorPage(){
 return <section className="workspace-page">
  <div className="workspace-heading"><div><span className="page-kicker">Управление сервисом</span><h1>Кабинет модератора</h1><p>Проверка предложенных точек и управление содержимым городской карты.</p></div><span className="workspace-icon">▣</span></div>
  <div className="moderator-layout">
   <nav className="moderator-nav"><div className="moderator-nav-title">Рабочая область</div><div className="moderator-nav-item active">▤ <span>Заявки</span></div><div className="moderator-nav-item disabled">⌖ <span>Опубликованные точки</span><small>Скоро</small></div><div className="moderator-nav-item disabled">◇ <span>Категории</span><small>Скоро</small></div></nav>
   <div className="moderator-content">
    <div className="moderator-panel-heading"><div><h2>Очередь заявок</h2><p>Новые предложения от посетителей карты.</p></div><span className="status-pill pending">Подключение API</span></div>
    <div className="moderator-empty"><div className="empty-icon">▤</div><h3>Модерация ещё не подключена</h3><p>Экран и навигация готовы. Следующим этапом подключим защищённую очередь заявок, ввод ключа модератора, просмотр заявок и действия одобрения или отклонения через API.</p></div>
   </div>
  </div>
 </section>;
}
