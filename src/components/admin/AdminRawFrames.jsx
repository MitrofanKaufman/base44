import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function AdminRawFrames() {
  const { data: frames = [] } = useQuery({
    queryKey: ['raw_marketplace_frames'],
    queryFn: () => base44.entities.RawMarketplaceFrame.list(),
  });

  return (
    <div className="space-y-4">
      {frames.length === 0 ? (
        <div className="bg-secondary/30 rounded-lg border border-border p-6 text-center text-muted-foreground">
          Raw frames не найдены
        </div>
      ) : (
        <div className="space-y-2">
          {frames.map(frame => (
            <div key={frame.id} className="bg-card rounded-lg border border-border p-4">
              <div className="font-semibold text-foreground">{frame.source} / {frame.stream}</div>
              <div className="text-xs text-muted-foreground mt-1">Event ID: {frame.sourceEventId}</div>
              <div className="bg-secondary/30 rounded p-2 font-mono text-[11px] overflow-auto max-h-40 mt-2">
                <pre className="text-foreground">{JSON.stringify(frame.payload, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}