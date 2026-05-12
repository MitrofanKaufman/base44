import { formatRub, formatPct } from '@/lib/unitEconomics';
import { buildBepView } from '@/lib/calculatorViewModel';

const Row = ({ label, value, sub, indent, bold, positive, negative }) => (
  <div className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold' : ''}`}>
    <span className={`text-xs ${indent ? 'text-muted-foreground' : 'text-foreground'}`}>{label}</span>
    <div className="text-right">
      <span className={`text-sm font-mono ${
        positive ? 'text-success font-semibold' :
        negative ? 'text-destructive font-semibold' :
        bold ? 'text-foreground font-bold' :
        'text-muted-foreground'
      }`}>{value}</span>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</p>
    {children}
  </div>
);

export default function PnlBreakdown({ result, form: _form }) {
  const bep = buildBepView(result);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

      {/* Revenue */}
      <Section title="Выручка">
        <Row label="Цена продажи"     value={formatRub(result.priceNet)} bold />
        <Row label="− Налог"          value={`−${formatRub(result.tax)}`}       indent />
        <Row label="− Эквайринг"      value={`−${formatRub(result.acquiring)}`} indent />
        <Row label="− Комиссия WB"    value={`−${formatRub(result.wbFee)}`}     indent />
        <Row label="− Промо"          value={`−${formatRub(result.promo)}`}     indent />
        <Row label="= Чистая выручка" value={formatRub(result.revenueNet)}  bold positive={result.revenueNet >= 0} />
      </Section>

      {/* COGS */}
      <Section title="Себестоимость и логистика">
        <Row label="Базовая себест."   value={`−${formatRub(result.cogsBase)}`} indent />
        <Row label="С браком"         value={`−${formatRub(result.cogsWithWaste)}`} bold />
        <Row label="Логистика/хран."  value={`−${formatRub(result.channelVar)}`} indent />
        <Row label="Потери на возврат" value={`−${formatRub(result.returnLossPerSale)}`} indent />
        <Row label="= Переменные" value={`−${formatRub(result.varCost)}`} bold negative={result.varCost > 0} />
      </Section>

      {/* Profit */}
      <Section title="Прибыль">
        <Row label="Валовая прибыль"  value={formatRub(result.grossProfit)}  bold positive={result.grossProfit >= 0} negative={result.grossProfit < 0} sub={formatPct(result.grossMarginPct, 'ratio')} />
        <Row label="− Маркетинг"      value={`−${formatRub(result.marketingCost)}`} indent />
        <Row
          label="Contribution margin"
          value={formatRub(result.contribution)}
          sub={formatPct(result.contributionPct, 'ratio')}
          bold
          positive={result.contribution >= 0}
          negative={result.contribution < 0}
        />
      </Section>

      {/* BEP / Summary */}
      <Section title="Итог">
        <div className={`rounded-md px-3 py-4 text-center mb-3 ${
          result.isProfitable
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-2xl font-bold ${result.isProfitable ? 'text-success' : 'text-destructive'}`}>
            {formatRub(result.contribution)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">contribution/ед.</p>
          <p className={`text-xs font-semibold mt-2 ${result.isProfitable ? 'text-success' : 'text-destructive'}`}>
            {result.isProfitable ? '✓ Прибыльно' : '✗ Убыточно'}
          </p>
        </div>
        {bep.isReachable && (
          <div className="text-center py-2 bg-accent rounded-md">
            <p className="text-xs text-muted-foreground">BEP</p>
            <p className="text-lg font-bold text-foreground">{bep.display}/мес</p>
            <p className="text-[10px] text-muted-foreground">точка безубыточности</p>
          </div>
        )}
        {!bep.isReachable && (
          <p className="text-xs text-center text-destructive bg-red-50 border border-red-200 rounded-md p-2">
            Точка безубыточности недостижима при текущих вводных
          </p>
        )}
      </Section>
    </div>
  );
}
