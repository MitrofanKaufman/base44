import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Maximize2,
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const LAYOUT_VERSION = 1;
const DEFAULT_MIN_COLUMN_WIDTH = 300;
const SPAN_SEQUENCE = [1, 2, 3, 'full'];

function normalizeSpan(span, fallback = 1) {
  if (span === 'full') return 'full';

  const numericSpan = Number(span);
  if ([1, 2, 3].includes(numericSpan)) {
    return numericSpan;
  }

  return normalizeSpan(fallback, 1);
}

function createDefaultLayout(items) {
  return items.map(item => ({
    id: item.id,
    span: normalizeSpan(item.defaultSpan),
  }));
}

function reconcileLayout(layout, items) {
  const itemsById = new Map(items.map(item => [item.id, item]));
  const seen = new Set();
  const nextLayout = [];

  layout.forEach(entry => {
    const item = itemsById.get(entry.id);
    if (!item) return;

    seen.add(entry.id);
    nextLayout.push({
      id: entry.id,
      span: normalizeSpan(entry.span, item.defaultSpan),
    });
  });

  items.forEach(item => {
    if (seen.has(item.id)) return;

    nextLayout.push({
      id: item.id,
      span: normalizeSpan(item.defaultSpan),
    });
  });

  return nextLayout;
}

function readLayout(storageKey, items) {
  if (typeof window === 'undefined' || !storageKey) {
    return createDefaultLayout(items);
  }

  try {
    const rawLayout = window.localStorage.getItem(storageKey);
    if (!rawLayout) {
      return createDefaultLayout(items);
    }

    const parsedLayout = JSON.parse(rawLayout);
    if (parsedLayout?.version !== LAYOUT_VERSION || !Array.isArray(parsedLayout.items)) {
      return createDefaultLayout(items);
    }

    return reconcileLayout(parsedLayout.items, items);
  } catch (_error) {
    return createDefaultLayout(items);
  }
}

function getSpanClass(span) {
  if (span === 'full') return 'md:col-span-full';
  if (span === 3) return 'md:col-span-2 xl:col-span-3';
  if (span === 2) return 'md:col-span-2';
  return 'col-span-1';
}

function getNextSpan(currentSpan, direction, allowedSpans = SPAN_SEQUENCE) {
  const normalizedCurrent = normalizeSpan(currentSpan);
  const currentIndex = allowedSpans.indexOf(normalizedCurrent);
  const fallbackIndex = allowedSpans.indexOf(1);
  const startIndex = currentIndex >= 0 ? currentIndex : Math.max(0, fallbackIndex);
  const nextIndex = Math.min(
    allowedSpans.length - 1,
    Math.max(0, startIndex + direction),
  );

  return allowedSpans[nextIndex];
}

function reorderLayout(layout, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return layout;

  const sourceIndex = layout.findIndex(item => item.id === sourceId);
  const targetIndex = layout.findIndex(item => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return layout;

  const nextLayout = [...layout];
  const [sourceItem] = nextLayout.splice(sourceIndex, 1);
  nextLayout.splice(targetIndex, 0, sourceItem);

  return nextLayout;
}

function TooltipIconButton({ label, children, className = undefined, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn('h-7 w-7', className)}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AdminDashboardGrid({
  items,
  storageKey,
  title = 'Компоновка блоков',
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  className = undefined,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [layout, setLayout] = useState(() => readLayout(storageKey, items));

  const itemSignature = items.map(item => `${item.id}:${item.defaultSpan || 1}`).join('|');
  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  useEffect(() => {
    setLayout(currentLayout => reconcileLayout(currentLayout, items));
  }, [itemSignature]);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: LAYOUT_VERSION,
        items: layout.map(({ id, span }) => ({ id, span })),
      }),
    );
  }, [layout, storageKey]);

  const orderedItems = useMemo(
    () => layout
      .map(entry => {
        const item = itemsById.get(entry.id);
        if (!item) return null;

        return {
          ...item,
          span: normalizeSpan(entry.span, item.defaultSpan),
        };
      })
      .filter(Boolean),
    [itemsById, layout],
  );

  const handleDragStart = useCallback((event, id) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain') || draggedId;

    setLayout(currentLayout => reorderLayout(currentLayout, sourceId, targetId));
    setDraggedId(null);
  }, [draggedId]);

  const moveItem = useCallback((id, direction) => {
    setLayout(currentLayout => {
      const currentIndex = currentLayout.findIndex(item => item.id === id);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentLayout.length) {
        return currentLayout;
      }

      const nextLayout = [...currentLayout];
      const [item] = nextLayout.splice(currentIndex, 1);
      nextLayout.splice(targetIndex, 0, item);
      return nextLayout;
    });
  }, []);

  const resizeItem = useCallback((id, direction) => {
    const item = itemsById.get(id);
    const allowedSpans = item?.allowedSpans || SPAN_SEQUENCE;

    setLayout(currentLayout => currentLayout.map(layoutItem => (
      layoutItem.id === id
        ? { ...layoutItem, span: getNextSpan(layoutItem.span, direction, allowedSpans) }
        : layoutItem
    )));
  }, [itemsById]);

  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    setLayout(createDefaultLayout(items));
  }, [items, storageKey]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-warm-sm">
          <div className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <TooltipIconButton label="Сбросить компоновку" onClick={resetLayout}>
                <RotateCcw className="h-4 w-4" />
              </TooltipIconButton>
            )}
            <Button
              type="button"
              size="sm"
              variant={isEditing ? 'default' : 'outline'}
              onClick={() => setIsEditing(value => !value)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isEditing ? 'Готово' : 'Настроить'}
            </Button>
          </div>
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))` }}
        >
          {orderedItems.map((item, index) => (
            <section
              key={item.id}
              onDragOver={isEditing ? handleDragOver : undefined}
              onDrop={isEditing ? event => handleDrop(event, item.id) : undefined}
              className={cn(
                'min-w-0 transition-opacity',
                getSpanClass(item.span),
                draggedId === item.id && 'opacity-60',
              )}
            >
              {isEditing && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-primary/40 bg-card/95 px-2 py-1.5">
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`Перетащить блок ${item.title || item.id}`}
                    onDragStart={event => handleDragStart(event, item.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className="inline-flex h-7 cursor-grab items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                    <span className="truncate">{item.title || item.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipIconButton
                      label="Сдвинуть левее"
                      onClick={() => moveItem(item.id, -1)}
                      disabled={index === 0}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      label="Сдвинуть правее"
                      onClick={() => moveItem(item.id, 1)}
                      disabled={index === orderedItems.length - 1}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      label="Уменьшить ширину"
                      onClick={() => resizeItem(item.id, -1)}
                    >
                      <Minimize2 className="h-4 w-4" />
                    </TooltipIconButton>
                    <TooltipIconButton
                      label="Увеличить ширину"
                      onClick={() => resizeItem(item.id, 1)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </TooltipIconButton>
                  </div>
                </div>
              )}
              {item.children}
            </section>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
