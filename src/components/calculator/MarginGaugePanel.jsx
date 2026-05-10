import { formatRub, formatPct } from '@/lib/unitEconomics';
import { CheckCircle, XCircle } from 'lucide-react';

function DonutGauge({ pct, size = 160 }) {
  const display = Math.max(-100, Math.min(100, pct));
  const positive = display >= 0;
  const radius = size * 0.38;
  const stroke = size * 0.09;
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
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute text-center pointer-events-none">
        <p className={`font-bold leading-none ${positive ? 'text-success' : 'text-destructive'}`}
           style={{ fontSize: size * 0.14 }}>
          {pct.toFixed(1)}%
        </p>
        <p className="text-muted-foreground font-semibold" style={{ fontSize: size * 0.075 }}>Маржа</p>
      </div>
    </div>
  );
}

const KpiRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 w-full">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-bold font-mono ${color || 'text-foreground'}`}>{value}</span>
  </div>
);

export default function MarginGaugePanel({ result }) {
  const pos = result.contribution >= 0;
  const contributionPct = result.priceNet > 0 ? (result.contribution / result.priceNet) * 100 : 0;

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4 flex flex-col items-center gap-4 h-full">
      <DonutGauge pct={result.grossMarginPct} size={164} />

      {/* Verdict badge */}
      <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border ${
        pos ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-destructive border-red-200'
      }`}>
        {pos ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {pos ? 'Прибыльно' : 'Убыточно'}
      </div>

      {/* Key metrics */}
      <div className="w-full mt-1">
        <KpiRow label="Валовая прибыль"      value={formatRub(result.grossProfit)}    color={result.grossProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <KpiRow label="Contribution margin"   value={formatRub(result.contribution)}   color={pos ? 'text-success' : 'text-destructive'} />
        <KpiRow label="Маржинальность"        value={formatPct(result.grossMarginPct)} />
        <KpiRow label="Contribution %"        value={formatPct(contributionPct)}       color={pos ? 'text-success' : 'text-destructive'} />
        <KpiRow label="Операционная прибыль" value={formatRub(result.contribution)}   color={pos ? 'text-success' : 'text-destructive'} />
        <KpiRow label="Рентабельность"        value={formatPct(contributionPct)}       color={pos ? 'text-success' : 'text-destructive'} />
        {result.bepUnits && (
          <KpiRow label="BEP (шт/мес)"       value={`${Math.ceil(result.bepUnits)} шт`} />
        )}
      </div>
    </div>
  );
}