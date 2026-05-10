import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function AdminEvents() {
  const { data: events = [] } = useQuery({
    queryKey: ['marketplace_events'],
    queryFn: () => base44.entities.MarketplaceEvent.list(),
  });

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <div className="bg-secondary/30 rounded-lg border border-border p-6 text-center text-muted-foreground">
          События не найдены
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="bg-card rounded-lg border border-border p-4">
              <div className="font-semibold text-foreground">{event.type}</div>
              <div className="text-xs text-muted-foreground mt-1">Source: {event.source} | ID: {event.sourceEventId}</div>
              <div className="bg-secondary/30 rounded p-2 font-mono text-[11px] overflow-auto max-h-32 mt-2">
                <pre className="text-foreground">{JSON.stringify(event.data, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}