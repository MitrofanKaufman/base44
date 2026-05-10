import { cn } from '@/lib/utils';

export default function ToggleGroup({ options, value, onChange, className }) {
  return (
    <div className={cn('flex gap-0.5 bg-secondary/50 rounded-md p-0.5 items-center', className)}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap',
            value === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}