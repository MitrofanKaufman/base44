export default function AdminDocumentation() {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Документация backend API</h2>
      <div className="prose prose-sm max-w-none text-foreground space-y-4">
        <div>
          <h3 className="font-semibold">REST API</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Локальный backend публикуется через префикс <code>/api</code>. Полная спецификация доступна в <code>/api/openapi.json</code>, интерактивная Swagger UI - в <code>/api/docs</code>.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Администрирование</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Метрики, рассылки, серверные расписанные задачи и heartbeat работают через защищенные admin endpoints: <code>/api/admin/metrics</code>, <code>/api/admin/broadcasts</code>, <code>/api/admin/scheduled-tasks</code>, <code>/api/activity/sessions</code>.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Wildberries</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Синхронизация справочников и товаров выполняется через backend routes <code>/api/wildberries/directories/logistics/sync</code>, <code>/api/wildberries/directories/commission/sync</code> и <code>/api/wildberries/products/:productId/sync</code>.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Worker</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Автоматические задачи выполняются в backend worker и сохраняют статус в PostgreSQL, поэтому их состояние не зависит от открытого браузера администратора.
          </p>
        </div>
      </div>
    </div>
  );
}
