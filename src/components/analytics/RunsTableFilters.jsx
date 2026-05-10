import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

export default function RunsTableFilters({ filters, onFilterChange, onClearFilters }) {
  const statusOptions = ['all', 'completed', 'failed', 'running', 'queued', 'cancelled', 'partial'];
  const sourceOptions = ['all', 'wildberries', 'yandex', 'ozon'];
  const modeOptions = ['all', 'product', 'seller', 'full'];

  return (
    <div className="flex flex-wrap gap-3 items-center p-3 bg-secondary/20 rounded-lg">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">Фильтры:</span>
      </div>

      <select
        value={filters.status}
        onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        className="px-2 py-1 text-xs border border-border rounded-lg bg-background"
      >
        {statusOptions.map(opt => (
          <option key={opt} value={opt}>{opt === 'all' ? 'Все статусы' : opt}</option>
        ))}
      </select>

      <select
        value={filters.source}
        onChange={(e) => onFilterChange({ ...filters, source: e.target.value })}
        className="px-2 py-1 text-xs border border-border rounded-lg bg-background"
      >
        {sourceOptions.map(opt => (
          <option key={opt} value={opt}>{opt === 'all' ? 'Все источники' : opt}</option>
        ))}
      </select>

      <select
        value={filters.mode}
        onChange={(e) => onFilterChange({ ...filters, mode: e.target.value })}
        className="px-2 py-1 text-xs border border-border rounded-lg bg-background"
      >
        {modeOptions.map(opt => (
          <option key={opt} value={opt}>{opt === 'all' ? 'Все режимы' : opt}</option>
        ))}
      </select>

      {(filters.status !== 'all' || filters.source !== 'all' || filters.mode !== 'all') && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1"
          onClick={onClearFilters}
        >
          <X className="w-3 h-3" />
          Сброс
        </Button>
      )}
    </div>
  );
}