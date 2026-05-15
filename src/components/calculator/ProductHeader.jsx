import { useState } from 'react';
import { AlertTriangle, Store, Copy, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import CalculatorParameterTooltip from './CalculatorParameterTooltip';
import ProductPickerDropdown from './ProductPickerDropdown';

const FieldLabel = ({ field, children, className = '' }) => (
  <span className={cn('inline-flex items-center gap-0.5 min-w-0', className)}>
    <span className="truncate">{children}</span>
    <CalculatorParameterTooltip field={field} />
  </span>
);

/* Tiny price input */
const PriceInput = ({ field, label, value, onChange, suffix = '₽', hint = null }) => (
  <div className="flex flex-col gap-0.5">
    <FieldLabel field={field} className={cn(
      'text-[9px] font-semibold uppercase tracking-wide leading-none',
      hint ? 'text-destructive' : 'text-muted-foreground',
    )}>{label}</FieldLabel>
    <div className={cn(
      'flex items-center border rounded-lg bg-secondary/40 h-[30px] px-1.5 gap-0.5',
      hint ? 'border-destructive/50 bg-destructive/5' : 'border-border',
    )}>
      <input
        type="number" min="0"
        value={value ?? ''}
        onChange={e => onChange(+e.target.value)}
        className="flex-1 min-w-0 w-0 bg-transparent text-[12px] font-semibold text-foreground focus:outline-none text-right"
        placeholder="0"
      />
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{suffix}</span>
    </div>
    {hint && (
      <div className="flex items-start gap-1 text-[9px] leading-tight text-destructive">
        <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-px" />
        <span>{hint.title}</span>
      </div>
    )}
  </div>
);

/* Tiny dimension pill */
const DimChip = ({ field, label, value, onChange, step = '1' }) => (
  <div className="flex flex-col items-center gap-0.5">
    <FieldLabel field={field} className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
      {label}
    </FieldLabel>
    <input
      type="number" min="0" step={step}
      value={value ?? ''}
      onChange={e => onChange(+e.target.value)}
      placeholder="0"
      className="w-11 h-[26px] rounded-lg border border-border bg-secondary/40 text-[11px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-ring"
    />
  </div>
);

/* Compact segmented control */
const Seg = ({ field, label, options, value, onChange }) => (
  <div className="flex flex-col gap-0.5">
    <FieldLabel field={field} className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
      {label}
    </FieldLabel>
    <div className="flex rounded-lg border border-border overflow-hidden h-[30px]">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 text-[10px] font-semibold transition-colors px-1 whitespace-nowrap',
            value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

export default function ProductHeader({ products, selectedProduct, onSelect, form, setField, fieldHints = {} }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isPallet = (form.package_mode || 'box') === 'pallet';
  const safeFieldHints = /** @type {Record<string, any>} */ (fieldHints);

  return (
    <div className="bg-card rounded-[18px] border border-border shadow-warm-sm flex flex-col gap-2 h-full" style={{ padding: '10px 12px' }}>

      {/* Row 1: Product picker */}
      <div className="relative flex-shrink-0">
        <div className="w-full flex items-center gap-1.5 px-2.5 h-[34px] rounded-xl bg-secondary/50 border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
          <button
            onClick={() => setPickerOpen(o => !o)}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
          >
            <Store className="w-3 h-3 flex-shrink-0 text-primary" />
            <span className="flex-1 text-left truncate min-w-0">
              {selectedProduct
                ? <><span className="text-foreground font-semibold">{selectedProduct.name}</span>{selectedProduct.wb_sku && <span className="ml-1.5 font-mono text-[9px] text-muted-foreground">SKU {selectedProduct.wb_sku}</span>}</>
                : <span>Выбрать товар из базы...</span>
              }
            </span>
          </button>
          {selectedProduct && (
            <button
              onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(selectedProduct.wb_sku || ''); }}
              className="hover:text-primary p-0.5 flex-shrink-0"
              title="Скопировать SKU"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setPickerOpen(o => !o)}
            className="p-0.5 flex-shrink-0 text-muted-foreground"
            title="Открыть список товаров"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', pickerOpen && 'rotate-180')} />
          </button>
        </div>
        {pickerOpen && (
          <ProductPickerDropdown
            products={products}
            selectedProduct={selectedProduct}
            onSelect={p => { 
              onSelect(p);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        
        {/* Commission hint */}
        {selectedProduct && (
          <div className="flex items-center gap-1.5 px-2 py-1 mt-1 rounded bg-primary/5 border border-primary/20 text-[10px]">
            <Info className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-muted-foreground">
              Комиссия WB: <strong className="text-foreground">{form.wb_commission_pct || 15}%</strong>
              {selectedProduct.category && <span> за {selectedProduct.category}</span>}
            </span>
          </div>
        )}
      </div>

      {/* Row 2: prices | dims | toggles */}
      <div className="flex-1 flex flex-col md:flex-row items-stretch gap-2 min-h-0">

        {/* Zone A: 2 price inputs stacked */}
        <div className="flex flex-col gap-1.5 justify-center w-full md:w-[130px]">
          <PriceInput field="price" label="Цена продажи" value={form.price} onChange={v => setField('price', v)} hint={safeFieldHints.price} />
          <PriceInput field="wb_cabinet_price" label="Цена кабинет WB" value={form.wb_cabinet_price} onChange={v => setField('wb_cabinet_price', v)} />
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-border flex-shrink-0 self-stretch" />

        {/* Zone B: plan + 4 dim chips */}
        <div className="flex flex-col gap-1.5 flex-1 justify-center min-w-0">
          <PriceInput field="monthly_plan" label="План / мес." value={form.monthly_plan} onChange={v => setField('monthly_plan', v)} suffix="шт." hint={safeFieldHints.monthly_plan} />
          <div className="flex gap-1.5 flex-wrap">
            <DimChip field="size_length_cm" label={isPallet ? 'Дл. кор.' : 'Длина'} value={form.size_length_cm} onChange={v => setField('size_length_cm', v)} />
            <DimChip field="size_width_cm" label={isPallet ? 'Шир. кор.' : 'Ширина'} value={form.size_width_cm} onChange={v => setField('size_width_cm', v)} />
            <DimChip field="size_height_cm" label={isPallet ? 'Выс. кор.' : 'Высота'} value={form.size_height_cm} onChange={v => setField('size_height_cm', v)} />
            <DimChip field="weight_kg" label="Вес кг" value={form.weight_kg} onChange={v => setField('weight_kg', v)} step="0.01" />
            {isPallet && (
              <DimChip field="wb_boxes_per_pallet" label="Кор./пал." value={form.wb_boxes_per_pallet} onChange={v => setField('wb_boxes_per_pallet', v)} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px bg-border flex-shrink-0 self-stretch" />

        {/* Zone C: toggles */}
        <div className="flex flex-col gap-1.5 justify-center flex-shrink-0 w-full md:w-[130px]">
          <Seg
            field="fulfillment_mode"
            label="Схема"
            options={[{ label: 'FBO', value: 'FBO' }, { label: 'FBS', value: 'FBS' }]}
            value={form.fulfillment_mode}
            onChange={v => setField('fulfillment_mode', v)}
          />
          <Seg
            field="package_mode"
            label="Упаковка"
            options={[{ label: 'Короб', value: 'box' }, { label: 'Паллет', value: 'pallet' }]}
            value={form.package_mode || 'box'}
            onChange={v => setField('package_mode', v)}
          />
        </div>

      </div>
    </div>
  );
}
