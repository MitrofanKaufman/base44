import { Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOpenApiSpec } from '@/lib/adminApi';

export default function AdminSwagger() {
  const [copied, setCopied] = useState(false);
  const { data: spec, isFetching, error } = useQuery({
    queryKey: ['openapi-spec'],
    queryFn: getOpenApiSpec,
  });

  const handleCopy = () => {
    if (!spec) return;
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">OpenAPI Specification</h2>
            <p className="text-xs text-muted-foreground mt-1">Источник: backend endpoint /api/openapi.json</p>
          </div>
          <button
            onClick={handleCopy}
            disabled={!spec}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 disabled:opacity-50"
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

        {isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Загрузка спецификации
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive">
            {error?.message || 'Не удалось загрузить OpenAPI specification'}
          </div>
        )}
        {spec && (
          <pre className="bg-secondary/30 rounded p-4 font-mono text-xs overflow-auto max-h-96 text-foreground">
            {JSON.stringify(spec, null, 2)}
          </pre>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        Интерактивная Swagger UI доступна по адресу <code>/api/docs</code>.
      </div>
    </div>
  );
}
