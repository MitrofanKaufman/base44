import { formatRub, formatPct, ratioToPercent } from '@/lib/unitEconomics';

function DonutGauge({ pct, size = 130 }) {
  const display = Math.max(-100, Math.min(100, pct));
  const positive = display >= 0;
  const radius = size * 0.4;
  const stroke = size * 0.08;
  const circumference = 2 * Math.PI * radius;
  const fillPct = Math.abs(display) / 100;
  const dashOffset = circumference * (1 - fillPct);
  const color = positive ? '#16a34a' : '#dc2626';
  const trackColor = positive ? '#dcfce7' : '#fee2e2';
  const cx = size / 2, cy = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className={`font-bold leading-none ${positive ? 'text-success' : 'text-destructive'}`}
           style={{ fontSize: size * 0.13 }}>
          {pct.toFixed(1)}%
        </p>
        <p className="text-muted-foreground font-semibold uppercase tracking-wide" style={{ fontSize: size * 0.07 }}>margin</p>
      </div>
    </div>
  );
}

export default function ContribGauge({ result, compact = false }) {
  const contribPos = result.contribution >= 0;
  const contributionPct = ratioToPercent(result.contributionPct ?? 0);

  if (compact) {
    // Compact version embedded inside InputsPanel
    return (
      <div className="flex flex-col items-center gap-2 w-[140px]">
        <DonutGauge pct={contributionPct} size={120} />
        <div className="w-full space-y-1">
          <div className="flex justify-between items-center py-1 px-2 bg-secondary/40 rounded-md">
            <span className="text-[10px] text-muted-foreground">На ед.</span>
            <span className={`text-xs font-bold ${contribPos ? 'text-success' : 'text-destructive'}`}>
              {formatRub(result.contribution)}
            </span>
          </div>
          <div className={`text-center text-[10px] font-semibold py-1 rounded-md ${
            result.isProfitable
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-destructive border border-red-200'
          }`}>
            {result.isProfitable ? '✓ Прибыльно' : '✗ Убыточно'}
          </div>
        </div>
      </div>
    );
  }

  // Full standalone version
  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4 flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground self-start">Contribution</p>

      <DonutGauge pct={contributionPct} size={140} />

      <div className="w-full space-y-2">
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/40">
          <span className="text-xs text-muted-foreground">На ед. товара</span>
          <span className={`text-sm font-bold ${contribPos ? 'text-success' : 'text-destructive'}`}>
            {formatRub(result.contribution)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/40">
          <span className="text-xs text-muted-foreground">Валовая прибыль</span>
          <span className={`text-sm font-semibold ${result.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatRub(result.grossProfit)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/40">
          <span className="text-xs text-muted-foreground">Маржа валовая</span>
          <span className="text-sm font-semibold">{formatPct(result.grossMarginPct, 'ratio')}</span>
        </div>
        <div className={`rounded-md px-3 py-2.5 text-center text-xs font-semibold ${
          result.isProfitable
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-destructive border border-red-200'
        }`}>
          {result.isProfitable ? '✓ Модель прибыльна' : '✗ Модель убыточна'}
        </div>
      </div>
    </div>
  );
}
