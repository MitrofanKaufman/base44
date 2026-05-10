export default function AdminDocumentation() {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Документация маркетплейс-ядра</h2>
      <div className="prose prose-sm max-w-none text-foreground space-y-4">
        <div>
          <h3 className="font-semibold">📖 README</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Полная документация архитектуры находится в файле <code>MARKETPLACE_CORE_README.md</code> в корне проекта.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">✅ Чек-лист</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Чек-лист интеграции находится в <code>INTEGRATION_CHECKLIST.md</code>.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">🔐 Безопасность</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Все события проверяются через HMAC-SHA256. Требует переменной окружения <code>INGESTION_SECRET</code>.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">📡 API</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Endpoint: <code>POST /functions/ingestion-receive</code>
          </p>
        </div>
      </div>
    </div>
  );
}