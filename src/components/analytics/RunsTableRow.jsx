import { Play, Square, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const StatusBadge = ({ status }) => {
  const styles = {
    completed: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
    running: 'bg-primary/10 text-primary',
    queued: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/10 text-destructive/60',
    partial: 'bg-warning/10 text-warning',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-muted text-muted-foreground'}`}>
      ● {status}
    </span>
  );
};

export default function RunsTableRow({ run, onStart, onCancel, onRetry, onDelete }) {
  return (
    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
      <td className="py-3 px-3 text-xs">{new Date(run.startedAt).toLocaleString('ru-RU')}</td>
      <td className="py-3 px-3 text-xs font-mono">{run.source}</td>
      <td className="py-3 px-3 text-xs">{run.mode}</td>
      <td className="py-3 px-3">
        <StatusBadge status={run.status} />
      </td>
      <td className="py-3 px-3 text-xs font-semibold">{run.counters?.eventCount || 0}</td>
      <td className="py-3 px-3 text-xs font-semibold text-destructive">{run.counters?.deadLetterCount || 0}</td>
      <td className="py-3 px-3 text-xs">{((run.durationMs || 0) / 1000).toFixed(2)}</td>
      <td className="py-3 px-3">
        <div className="flex gap-1">
          {run.status !== 'running' && (
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => onStart?.(run)}
              title="Запустить"
            >
              <Play className="w-3.5 h-3.5" />
            </Button>
          )}
          {run.status === 'running' && (
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onCancel?.(run)}
              title="Остановить"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          )}
          {run.status === 'failed' && (
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 text-warning hover:text-warning hover:bg-warning/10"
              onClick={() => onRetry?.(run)}
              title="Повторить"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete?.(run)}
            title="Удалить"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}