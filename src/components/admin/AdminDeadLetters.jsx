import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle } from 'lucide-react';

export default function AdminDeadLetters() {
  const { data: deadLetters = [] } = useQuery({
    queryKey: ['dead_letters'],
    queryFn: () => base44.entities.DeadLetter.list(),
  });

  const unresolved = deadLetters.filter(dl => !dl.resolved);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="font-semibold text-foreground">Неразрешённые ошибки: {unresolved.length}</span>
        </div>
      </div>

      {unresolved.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-700">
          Ошибок не обнаружено ✓
        </div>
      ) : (
        <div className="space-y-3">
          {unresolved.map(dl => (
            <div key={dl.id} className="bg-card rounded-lg border-2 border-destructive/30 p-4">
              <div className="font-semibold text-destructive">{dl.reason}</div>
              <div className="text-xs text-muted-foreground mt-1">{dl.message}</div>
              <div className="bg-secondary/30 rounded p-2 font-mono text-[11px] overflow-auto max-h-40 mt-2">
                <pre className="text-foreground">{JSON.stringify(dl.payload, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}