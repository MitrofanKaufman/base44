import { Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export default function AdminSwagger() {
  const [copied, setCopied] = useState(false);

  const spec = {
    openapi: '3.1.0',
    info: { title: 'Маркетплейс-ядро API', version: '1.0.0' },
    paths: {
      '/ingestion-receive': {
        post: {
          summary: 'Receive marketplace events',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } }
          }
        }
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">OpenAPI 3.1 Specification</h2>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
          >
            {copied ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Копировать
              </>
            )}
          </button>
        </div>
        <pre className="bg-secondary/30 rounded p-4 font-mono text-xs overflow-auto max-h-96 text-foreground">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        Полный OpenAPI spec и примеры интеграции см. в <code>MARKETPLACE_CORE_README.md</code>
      </div>
    </div>
  );
}