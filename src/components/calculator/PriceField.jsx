export default function PriceField({ label, value, onChange, suffix }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1.5 h-9">
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={e => onChange(+e.target.value)}
          className="flex-1 min-w-0 h-9 rounded-md border border-input bg-transparent px-2.5 text-[15px] font-bold focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="0"
        />
        <span className="text-sm font-bold text-muted-foreground flex-shrink-0">{suffix}</span>
      </div>
    </div>
  );
}