import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3, AlertTriangle, Clock } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color = 'text-primary' }) => (
  <div className="bg-card rounded-lg border border-border p-4 space-y-2">
    <div className="flex items-center gap-2">
      <Icon className={`w-5 h-5 ${color}`} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
  </div>
);

export default function AdminOverview() {
  const { data: events = [] } = useQuery({
    queryKey: ['marketplace_events'],
    queryFn: () => base44.entities.MarketplaceEvent.list(),
  });

  const { data: rawFrames = [] } = useQuery({
    queryKey: ['raw_frames'],
    queryFn: () => base44.entities.RawMarketplaceFrame.list(),
  });

  const { data: deadLetters = [] } = useQuery({
    queryKey: ['dead_letters'],
    queryFn: () => base44.entities.DeadLetter.list(),
  });

  const { data: ingestionRuns = [] } = useQuery({
    queryKey: ['ingestion_runs'],
    queryFn: () => base44.entities.IngestionRun.list(),
  });

  const lastRun = ingestionRuns?.[0];
  const unresolvedErrors = deadLetters?.filter(dl => !dl.resolved).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Событий обработано" value={events?.length ?? 0} />
        <StatCard icon={BarChart3} label="Raw Frames получено" value={rawFrames?.length ?? 0} />
        <StatCard icon={AlertTriangle} label="Неразрешённых ошибок" value={unresolvedErrors} color="text-destructive" />
        <StatCard icon={Clock} label="Последний run" value={lastRun?.status ?? 'нет'} />
      </div>

      {lastRun && (
        <div className="bg-card rounded-lg border border-border p-6 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Последний запуск ингестии</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Источник</span>
              <p className="font-semibold text-foreground">{lastRun.source || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Статус</span>
              <p className={`font-semibold ${lastRun.status === 'completed' ? 'text-success' : 'text-warning'}`}>
                {lastRun.status}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Обработано событий</span>
              <p className="font-semibold text-foreground">{lastRun.eventsProcessed ?? 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ошибок</span>
              <p className={`font-semibold ${lastRun.eventsError > 0 ? 'text-destructive' : 'text-success'}`}>
                {lastRun.eventsError ?? 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}