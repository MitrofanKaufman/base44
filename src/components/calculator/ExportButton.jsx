import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { formatRub, formatPct, ratioToPercent } from '@/lib/unitEconomics';
import { buildCalculatorViewModel } from '@/lib/calculatorViewModel';
import jsPDF from 'jspdf';

// Excel export via CSV (no extra deps)
function exportToExcel(form, result, productName, versionName) {
  const view = buildCalculatorViewModel(form, result);
  const rows = [
    ['Юнит-экономика — ' + (productName || 'Товар'), ''],
    ['Версия', versionName || ''],
    ['Дата', new Date().toLocaleDateString('ru-RU')],
    ['', ''],
    ['ВЫРУЧКА', ''],
    ['Цена продажи', form.price],
    ['Налог (%)', form.tax_pct],
    ['Эквайринг (%)', form.acquiring_pct],
    ['Комиссия WB (%)', form.wb_commission_pct],
    ['Промо (%)', form.promo_pct],
    ['Чистая выручка', result.revenueNet],
    ['', ''],
    ['СЕБЕСТОИМОСТЬ', ''],
    ['Закупка', form.cogs_purchase],
    ['Упаковка', form.cogs_packaging],
    ['Сборка', form.cogs_fulfillment],
    ['Доставка до WB', form.cogs_inbound_to_wb],
    ['Брак (%)', form.waste_pct],
    ['Себестоимость с браком', result.cogsWithWaste],
    ['', ''],
    ['ЛОГИСТИКА / ХРАНЕНИЕ', ''],
    ['Логистика/хранение (канал)', result.channelVar],
    ['Потери на возврат', result.returnLossPerSale],
    ['', ''],
    ['МАРКЕТИНГ', ''],
    ['CAC', form.cac],
    ['Доля платного трафика (%)', form.paid_share_pct],
    ['Маркетинг на единицу', result.marketingCost],
    ['Постоянные расходы/мес', form.fixed_monthly],
    ['', ''],
    ['ИТОГ', ''],
    ['Валовая прибыль', result.grossProfit],
    ['Валовая маржа (%)', ratioToPercent(result.grossMarginPct)],
    ['Contribution margin', result.contribution],
    ['Contribution (%)', ratioToPercent(result.contributionPct)],
    ['BEP (шт/мес)', view.bep.isReachable ? view.bep.display : 'Не окупается'],
    ['Прибыльность', result.isProfitable ? 'Прибыльно ✓' : 'Убыточно ✗'],
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `unit-economics-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPdf(form, result, productName, versionName) {
  const view = buildCalculatorViewModel(form, result);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 18;

  const line = (text, value, indent = 0, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(String(text), 14 + indent, y);
    if (value !== undefined) doc.text(String(value), W - 14, y, { align: 'right' });
    y += 6;
  };

  const section = (title) => {
    y += 3;
    doc.setFillColor(247, 241, 234);
    doc.roundedRect(12, y - 4, W - 24, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 60, 20);
    doc.text(title.toUpperCase(), 16, y + 0.5);
    doc.setTextColor(30, 20, 10);
    y += 8;
  };

  // Header
  doc.setFillColor(163, 71, 35);
  doc.rect(0, 0, W, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Unit Economics Report', 14, 9.5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('ru-RU'), W - 14, 9.5, { align: 'right' });
  doc.setTextColor(30, 20, 10);

  y = 22;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(productName || 'Товар', 14, y); y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 80, 60);
  doc.text(`Версия: ${versionName || '—'}   Схема: ${form.fulfillment_mode}`, 14, y);
  doc.setTextColor(30, 20, 10);
  y += 10;

  section('Выручка');
  line('Цена продажи', formatRub(form.price));
  line('− Налог', `${form.tax_pct}%`);
  line('− Эквайринг', `${form.acquiring_pct}%`);
  line('− Комиссия WB', `${form.wb_commission_pct}%`);
  line('− Промо', `${form.promo_pct}%`);
  line('Чистая выручка', formatRub(result.revenueNet), 0, true);

  section('Себестоимость');
  line('Закупка', formatRub(form.cogs_purchase));
  line('Упаковка', formatRub(form.cogs_packaging));
  line('Сборка', formatRub(form.cogs_fulfillment));
  line('Доставка до WB', formatRub(form.cogs_inbound_to_wb));
  line('Брак/списания', `${form.waste_pct}%`);
  line('Итого себестоимость', formatRub(result.cogsWithWaste), 0, true);

  section('Логистика и хранение');
  line('Логистика/хранение', formatRub(result.channelVar));
  line('Потери на возврат', formatRub(result.returnLossPerSale));
  line('Валовая прибыль', formatRub(result.grossProfit), 0, true);

  section('Маркетинг');
  line('CAC', formatRub(form.cac));
  line('Доля платного трафика', `${form.paid_share_pct}%`);
  line('Маркетинг на единицу', formatRub(result.marketingCost), 0, true);

  section('Итоговые метрики');
  line('Валовая маржа', formatPct(result.grossMarginPct, 'ratio'));
  line('Contribution margin', formatRub(result.contribution), 0, true);
  line('Contribution %', formatPct(result.contributionPct, 'ratio'), 0, true);
  if (view.bep.isReachable) line('BEP (шт/мес)', view.bep.display);
  line('Постоянные расходы/мес', formatRub(form.fixed_monthly));

  y += 4;
  const verdict = result.isProfitable;
  doc.setFillColor(verdict ? 220 : 254, verdict ? 250 : 226, verdict ? 230 : 226);
  doc.roundedRect(12, y, W - 24, 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(verdict ? 22 : 185, verdict ? 101 : 28, verdict ? 52 : 28);
  doc.text(verdict ? '✓ Модель прибыльна' : '✗ Модель убыточна', W / 2, y + 9, { align: 'center' });

  doc.save(`unit-economics-${Date.now()}.pdf`);
}

export default function ExportButton({ form, result, productName, versionName }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors text-sm font-medium text-foreground shadow-warm-sm sm:w-auto"
      >
        <Download className="w-3.5 h-3.5" />
        Экспорт
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-warm-lg overflow-hidden min-w-[160px]">
            <button
              onClick={() => { exportToPdf(form, result, productName, versionName); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-red-500" />
              Скачать PDF
            </button>
            <button
              onClick={() => { exportToExcel(form, result, productName, versionName); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left border-t border-border"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              Скачать Excel (CSV)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
