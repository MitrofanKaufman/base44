import { useState, useEffect } from 'react';
import { SyncScheduler } from '@/lib/SyncScheduler';
import { RefreshCw, Check, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SyncStatusWidget() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 10000); // обновляем каждые 10 сек
    return () => clearInterval(interval);
  }, []);

  const updateStatus = () => {
    const status = SyncScheduler.getStatus();
    setStatus(status);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    await SyncScheduler.runSync();
    setSyncing(false);
    updateStatus();
  };

  const handleChangeInterval = (minutes) => {
    SyncScheduler.setInterval(minutes);
    updateStatus();
  };

  if (!status) {
    return null;
  }

  const lastLog = status.logs?.[status.logs.length - 1];
  const isInitialized = status.initialized;

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Статус синхронизации WB API</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isInitialized ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
        }`}>
          {isInitialized ? (
            <>
              <Check className="w-3 h-3" />
              Активна
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              Неактивна
            </>
          )}
        </div>
      </div>

      {lastLog && (
        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Последняя синхронизация:</span>
            <span className="font-mono">{new Date(lastLog.timestamp).toLocaleTimeString()}</span>
          </div>
          {lastLog.result && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Клиентов:</span>
                <span className="font-semibold">{lastLog.result.total_clients || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Продаж:</span>
                <span className="font-semibold text-success">{lastLog.result.total_sales || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Цены:</span>
                <span className="font-semibold text-success">{lastLog.result.total_prices || 0}</span>
              </div>
            </>
          )}
        </div>
      )}

      {status.inProgress && (
        <div className="flex items-center gap-2 text-xs text-primary">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Синхронизация в процессе...
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Интервал синхронизации</label>
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 60, 120].map(minutes => (
            <button
              key={minutes}
              onClick={() => handleChangeInterval(minutes)}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                status.intervalMinutes === minutes
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {minutes} мин
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={handleManualSync}
        disabled={syncing || status.inProgress}
        variant="outline"
        size="sm"
        className="w-full gap-2"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
      </Button>

      {status.logs?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
            История синхронизации ({status.logs.length})
          </summary>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {[...status.logs].reverse().map((log, idx) => (
              <div key={idx} className="bg-secondary/20 p-2 rounded text-muted-foreground text-[10px]">
                <div>{new Date(log.timestamp).toLocaleString()}</div>
                {log.result && (
                  <div className="mt-1">
                    Продаж: {log.result.total_sales}, Цен: {log.result.total_prices}
                  </div>
                )}
                {log.result?.error && (
                  <div className="text-destructive mt-1">{log.result.error}</div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}