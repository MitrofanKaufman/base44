import { ChevronUp, ChevronDown } from 'lucide-react';

export default function RunsTableHeader({ sortBy, sortOrder, onSort, onFilter: _onFilter }) {
  const columns = [
    { key: 'date', label: 'Дата', sortable: true },
    { key: 'source', label: 'Источник', sortable: true },
    { key: 'mode', label: 'Режим', sortable: true },
    { key: 'status', label: 'Статус', sortable: true },
    { key: 'events', label: 'События', sortable: true },
    { key: 'errors', label: 'Ошибки', sortable: true },
    { key: 'duration', label: 'Время (сек)', sortable: true },
    { key: 'actions', label: 'Действия', sortable: false },
  ];

  const SortIcon = ({ col }) => {
    if (sortBy !== col.key) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <thead>
      <tr className="border-b border-border">
        {columns.map(col => (
          <th key={col.key} className="text-left py-3 px-3">
            {col.sortable ? (
              <button
                onClick={() => onSort(col.key)}
                className="flex items-center gap-1 font-semibold text-sm text-foreground hover:text-primary transition-colors"
              >
                {col.label}
                <SortIcon col={col} />
              </button>
            ) : (
              <span className="font-semibold text-sm text-foreground">{col.label}</span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}
