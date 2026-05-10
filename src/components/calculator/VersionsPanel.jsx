import { Plus, Copy, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRub } from '@/lib/unitEconomics';

export default function VersionsPanel({ versions, activeIdx, onSelect, onAdd, onDuplicate, onRemove }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex-shrink-0">Версии:</span>
      {versions.map((v, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex-shrink-0',
            i === activeIdx
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
          )}
        >
          {i === activeIdx && <Check className="w-3 h-3" />}
          <span>{v.name || `Версия ${i + 1}`}</span>
          {v.result && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-bold',
              v.result.isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            )}>
              {formatRub(v.result.contribution)}
            </span>
          )}
          {versions.length > 1 && (
            <span
              className="ml-1 opacity-50 hover:opacity-100"
              onClick={e => { e.stopPropagation(); onRemove(i); }}
            >
              <Trash2 className="w-3 h-3" />
            </span>
          )}
        </button>
      ))}

      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-all flex-shrink-0"
      >
        <Plus className="w-3 h-3" /> Сценарий
      </button>

      <button
        onClick={onDuplicate}
        title="Дублировать текущую версию"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-all flex-shrink-0"
      >
        <Copy className="w-3 h-3" /> Копия
      </button>
    </div>
  );
}