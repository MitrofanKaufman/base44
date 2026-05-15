import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { normalizeIngestionRun } from '@/lib/ingestionRunCounters';

function StageIcon({ status }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-success" />;
  if (status === 'running') return <Zap className="w-4 h-4 text-primary animate-pulse" />;
  if (status === 'failed') return <AlertTriangle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

export default function RunDetailsModal({ run, isOpen, onClose }) {
  if (!run) return null;
  const normalizedRun = normalizeIngestionRun(run);
  const counters = normalizedRun.counters;

  const statusColor = {
    completed: 'text-success',
    failed: 'text-destructive',
    running: 'text-primary',
    queued: 'text-muted-foreground',
    cancelled: 'text-amber-500',
    partial: 'text-purple-500'
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Прогон #{normalizedRun.runId?.substring(0, 8)}</span>
            <span className={`text-sm font-bold ${statusColor[normalizedRun.status]}`}>
              {normalizedRun.status?.toUpperCase()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Основная информация */}
            <Card className="p-4">
              <h3 className="font-bold text-base mb-3">Информация</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Маркетплейс:</span>
                  <p className="font-semibold">{normalizedRun.source}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Режим:</span>
                  <p className="font-semibold">{normalizedRun.mode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Источник данных:</span>
                  <p className="font-semibold">{normalizedRun.sourceMode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Прогресс:</span>
                  <p className="font-semibold">{normalizedRun.progress || 0}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Начало:</span>
                  <p className="font-mono text-xs">{new Date(normalizedRun.startedAt).toLocaleString()}</p>
                </div>
                {normalizedRun.finishedAt && (
                  <div>
                    <span className="text-muted-foreground">Окончание:</span>
                    <p className="font-mono text-xs">{new Date(normalizedRun.finishedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Счетчики */}
            <Card className="p-4">
              <h3 className="font-bold text-base mb-3">Обработано</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: 'Events', value: counters.eventCount },
                  { label: 'Raw Frames', value: counters.rawFrameCount },
                  { label: 'Prod Snapshots', value: counters.productSnapshotCount },
                  { label: 'Unit Economics', value: counters.unitEconomicsCount },
                  { label: 'Seller Snapshots', value: counters.sellerSnapshotCount },
                  { label: 'Errors', value: counters.eventsError },
                  { label: 'Dead Letters', value: counters.deadLetterCount },
                  { label: 'Processed', value: counters.eventsProcessed }
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary/50 rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Timeline этапов */}
            <Card className="p-4">
              <h3 className="font-bold text-base mb-3">Этапы выполнения</h3>
              <div className="space-y-2">
                {normalizedRun.timeline.map((stage) => (
                  <div key={stage.stage} className="flex items-start gap-3 p-2 bg-secondary/30 rounded">
                    <StageIcon status={stage.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold">{stage.stage}</p>
                        <span className={`text-xs font-bold ${
                          stage.status === 'completed' ? 'text-success' :
                          stage.status === 'failed' ? 'text-destructive' :
                          stage.status === 'running' ? 'text-primary' :
                          'text-muted-foreground'
                        }`}>
                          {stage.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {stage.startedAt && (
                          <span>{new Date(stage.startedAt).toLocaleTimeString()}</span>
                        )}
                        {stage.durationMs && (
                          <span>• {formatDuration(stage.durationMs)}</span>
                        )}
                      </div>
                      {stage.error && (
                        <div className="mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                          {stage.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Глобальные ошибки прогона */}
            {normalizedRun.errors && normalizedRun.errors.length > 0 && (
              <Card className="p-4">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Ошибки прогона ({normalizedRun.errors.length})
                </h3>
                <div className="space-y-2">
                  {normalizedRun.errors.map((error, idx) => (
                    <div key={idx} className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      <p className="font-mono text-xs text-muted-foreground mb-1">
                        {error.timestamp ? new Date(error.timestamp).toLocaleString() : `Error #${idx + 1}`}
                      </p>
                      <p className="text-foreground font-semibold">{error.message || error}</p>
                      {error.context && (
                        <pre className="mt-2 p-2 bg-secondary/50 rounded text-xs overflow-auto max-h-32">
                          {typeof error.context === 'string' ? error.context : JSON.stringify(error.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Отчет */}
            {normalizedRun.report && (
              <Card className="p-4">
                <h3 className="font-bold text-base mb-3">Финальный отчет</h3>
                <pre className="p-3 bg-secondary/50 rounded text-xs overflow-auto max-h-48">
                  {JSON.stringify(normalizedRun.report, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
