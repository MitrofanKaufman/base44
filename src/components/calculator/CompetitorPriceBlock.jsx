import { useState, useMemo } from 'react';
import { Plus, Trash2, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculate, formatRub, formatPct, ratioToPercent } from '@/lib/unitEconomics';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

function calcMetrics(price, form) {
  const tweaked = { ...form, price };
  const res = calculate(tweaked);
  return {
    grossMarginPct: res.grossMarginPct,
    contribution: res.contribution,
    contributionPct: res.contributionPct,
    isProfitable: res.isProfitable,
  };
}

export default function CompetitorPriceBlock({ form, myResult }) {
  const [competitors, setCompetitors] = useState([
    { name: 'Конкурент 1', price: 0 },
    { name: 'Конкурент 2', price: 0 },
  ]);

  const myPrice = form.price || 0;

  const rows = useMemo(() => competitors.map((c, i) => ({
    ...c,
    color: COLORS[i % COLORS.length],
    metrics: c.price > 0 ? calcMetrics(c.price, form) : null,
  })), [competitors, form]);

  const myMetrics = {
    grossMarginPct: myResult.grossMarginPct,
    contribution: myResult.contribution,
    contributionPct: myResult.contributionPct,
    isProfitable: myResult.isProfitable,
  };

  const addCompetitor = () => {
    if (competitors.length >= 5) return;
    setCompetitors(c => [...c, { name: `Конкурент ${c.length + 1}`, price: 0 }]);
  };

  const removeCompetitor = (i) => setCompetitors(c => c.filter((_, idx) => idx !== i));

  const updateCompetitor = (i, field, val) =>
    setCompetitors(c => c.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const Delta = ({ val, suffix = '%', invert = false }) => {
    if (val == null || isNaN(val)) return <span className="text-muted-foreground text-[11px]">—</span>;
    const positive = invert ? val < 0 : val > 0;
    const Icon = val === 0 ? Minus : positive ? TrendingUp : TrendingDown;
    return (
      <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${positive ? 'text-success' : val === 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
        <Icon className="w-3 h-3" />
        {val > 0 ? '+' : ''}{typeof val === 'number' ? val.toFixed(1) : val}{suffix}
      </span>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Анализ цен конкурентов</span>
        </div>
        {competitors.length < 5 && (
          <button
            onClick={addCompetitor}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-40">Участник</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-3">Цена, ₽</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-3">∆ к моей</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-3">Вал. маржа</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-3">Contribution</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-3">Contrib %</th>
              <th className="text-right pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">∆ маржи</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {/* My row */}
            <tr className="border-b border-border/50 bg-primary/5">
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="font-semibold text-foreground">Мой товар</span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right font-mono font-bold text-foreground">{myPrice > 0 ? formatRub(myPrice) : '—'}</td>
              <td className="py-2 pr-3 text-right text-muted-foreground text-[11px]">—</td>
              <td className="py-2 pr-3 text-right">
                <span className={`font-mono font-bold ${myMetrics.grossMarginPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {myPrice > 0 ? formatPct(myMetrics.grossMarginPct, 'ratio') : '—'}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">
                <span className={`font-mono font-bold ${myMetrics.contribution >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {myPrice > 0 ? formatRub(myMetrics.contribution) : '—'}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">
                <span className={`font-mono font-bold ${myMetrics.contributionPct >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {myPrice > 0 ? formatPct(myMetrics.contributionPct, 'ratio') : '—'}
                </span>
              </td>
              <td className="py-2 text-right text-muted-foreground text-[11px]">—</td>
              <td />
            </tr>

            {/* Competitor rows */}
            {rows.map((c, i) => {
              const priceDelta = c.price > 0 && myPrice > 0 ? c.price - myPrice : null;
              const priceDeltaPct = priceDelta != null ? (priceDelta / myPrice) * 100 : null;
              const marginDelta = c.metrics && myPrice > 0
                ? ratioToPercent(c.metrics.grossMarginPct - myMetrics.grossMarginPct)
                : null;

              return (
                <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      <input
                        value={c.name}
                        onChange={e => updateCompetitor(i, 'name', e.target.value)}
                        className="bg-transparent text-[12px] font-medium text-foreground focus:outline-none border-b border-transparent focus:border-border w-28 truncate"
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min="0"
                        value={c.price || ''}
                        onChange={e => updateCompetitor(i, 'price', +e.target.value)}
                        placeholder="0"
                        className="w-20 h-6 bg-secondary/40 border border-input rounded px-2 text-[12px] font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-muted-foreground text-[11px]">₽</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {priceDeltaPct != null
                      ? <Delta val={priceDeltaPct} suffix="%" invert />
                      : <span className="text-muted-foreground text-[11px]">—</span>
                    }
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {c.metrics
                      ? <span className={`font-mono font-bold ${c.metrics.grossMarginPct >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPct(c.metrics.grossMarginPct, 'ratio')}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {c.metrics
                      ? <span className={`font-mono font-bold ${c.metrics.contribution >= 0 ? 'text-success' : 'text-destructive'}`}>{formatRub(c.metrics.contribution)}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {c.metrics
                      ? <span className={`font-mono font-bold ${c.metrics.contributionPct >= 0 ? 'text-success' : 'text-destructive'}`}>{formatPct(c.metrics.contributionPct, 'ratio')}</span>
                      : <span className="text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-2 text-right">
                    {marginDelta != null
                      ? <Delta val={marginDelta} suffix="п.п." />
                      : <span className="text-muted-foreground text-[11px]">—</span>
                    }
                  </td>
                  <td className="py-2 pl-2">
                    <button onClick={() => removeCompetitor(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bar chart comparison */}
      {(myPrice > 0 || rows.some(r => r.price > 0)) && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Сравнение маржинальности</p>
          <div className="space-y-2">
            {/* My bar */}
            {myPrice > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-foreground font-semibold w-28 truncate flex-shrink-0">Мой товар</span>
                <div className="flex-1 bg-secondary/40 rounded-full h-4 overflow-hidden relative">
                  <div
                    className="h-4 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, ratioToPercent(myMetrics.grossMarginPct)))}%`,
                      background: myMetrics.grossMarginPct >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white mix-blend-difference">
                    {formatPct(myMetrics.grossMarginPct, 'ratio')}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-foreground w-14 text-right flex-shrink-0">{formatRub(myPrice)}</span>
              </div>
            )}
            {rows.filter(r => r.price > 0 && r.metrics).map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-28 truncate flex-shrink-0">{c.name}</span>
                <div className="flex-1 bg-secondary/40 rounded-full h-4 overflow-hidden relative">
                  <div
                    className="h-4 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, ratioToPercent(c.metrics.grossMarginPct)))}%`,
                      background: c.metrics.grossMarginPct >= 0 ? c.color : '#dc2626',
                    }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white mix-blend-difference">
                    {formatPct(c.metrics.grossMarginPct, 'ratio')}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-muted-foreground w-14 text-right flex-shrink-0">{formatRub(c.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3">
        * Маржинальность конкурентов рассчитывается по вашей структуре затрат. Цены вводите вручную.
      </p>
    </div>
  );
}
