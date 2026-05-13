import { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  ChevronDown,
  GripVertical,
  Maximize2,
  Minimize2,
  Minus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const LAYOUT_VERSION = 2;
const DEFAULT_MIN_COLUMN_WIDTH = 300;
const SPAN_SEQUENCE = [1, 2, 3, 'full'];

function normalizeSpan(span, fallback = 1) {
  if (span === 'full') return 'full';

  const numericSpan = Number(span);
  if ([1, 2, 3].includes(numericSpan)) return numericSpan;

  return normalizeSpan(fallback, 1);
}

function createDefaultLayout(items) {
  return items.map(item => ({
    id: item.id,
    span: normalizeSpan(item.defaultSpan),
    collapsed: Boolean(item.defaultCollapsed),
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
      collapsed: Boolean(entry.collapsed ?? item.defaultCollapsed),
    });
  });

  items.forEach(item => {
    if (seen.has(item.id)) return;

    nextLayout.push({
      id: item.id,
      span: normalizeSpan(item.defaultSpan),
      collapsed: Boolean(item.defaultCollapsed),
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
    if (!rawLayout) return createDefaultLayout(items);

    const parsedLayout = JSON.parse(rawLayout);
    if (parsedLayout?.version !== LAYOUT_VERSION || !Array.isArray(parsedLayout.items)) {
      return createDefaultLayout(items);
    }

    return reconcileLayout(parsedLayout.items, items);
  } catch (_error) {
    return createDefaultLayout(items);
  }
}

function persistLayout(storageKey, layout) {
  if (typeof window === 'undefined' || !storageKey) return;

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: LAYOUT_VERSION,
        items: layout.map(({ id, span, collapsed }) => ({ id, span, collapsed })),
      }),
    );
  } catch (_error) {
    // Пользовательская компоновка не должна ломать работу страницы.
  }
}

function getSpanClass(span) {
  if (span === 'full') return 'md:col-span-full';
  if (span === 3) return 'md:col-span-2 xl:col-span-3';
  if (span === 2) return 'md:col-span-2';
  return 'col-span-1';
}

function getRowSpanClass(rowSpan) {
  const numericRowSpan = Number(rowSpan);
  if (numericRowSpan === 3) return 'xl:row-span-3';
  if (numericRowSpan === 2) return 'xl:row-span-2';
  return undefined;
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

function reorder(list, startIndex, endIndex) {
  if (startIndex === endIndex) return list;

  const next = [...list];
  const [removed] = next.splice(startIndex, 1);
  next.splice(endIndex, 0, removed);
  return next;
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

function AdaptiveGridItem({
  item,
  isEditing,
  draggableProvided,
  draggableSnapshot,
  resizeItem,
  toggleItem,
}) {
  const canCollapse = item.disableCollapse !== true;
  const isCollapsed = canCollapse && item.collapsed;

  return (
    <section
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      className={cn(
        'min-w-0 transition-opacity',
        getSpanClass(item.span),
        !isCollapsed && getRowSpanClass(item.defaultRowSpan),
        draggableSnapshot.isDragging && 'z-20 opacity-90',
      )}
      style={{
        ...draggableProvided.draggableProps.style,
        minHeight: item.minHeight,
      }}
    >
      {isEditing && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-primary/40 bg-card/95 px-2 py-1.5">
          <div
            {...draggableProvided.dragHandleProps}
            className="inline-flex h-7 min-w-0 cursor-grab items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.title || item.id}</span>
          </div>
          <div className="flex items-center gap-1">
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
      <Collapsible
        open={!isCollapsed}
        onOpenChange={canCollapse ? () => toggleItem(item.id) : undefined}
        className="relative min-w-0"
      >
        {isCollapsed ? (
          <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-warm-sm">
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {item.title || item.id}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Развернуть блок ${item.title || item.id}`}
                    className="h-7 w-7 flex-shrink-0"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>Развернуть блок</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            {canCollapse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Свернуть блок ${item.title || item.id}`}
                      className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full border border-border bg-card/95 text-muted-foreground shadow-warm-sm backdrop-blur hover:text-foreground"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent>Свернуть блок</TooltipContent>
              </Tooltip>
            )}
            <CollapsibleContent>{item.children}</CollapsibleContent>
          </>
        )}
      </Collapsible>
    </section>
  );
}

export default function AdaptiveDashboardGrid({
  items,
  storageKey,
  title = 'Компоновка блоков',
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  desktopColumns = undefined,
  className = undefined,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState(() => readLayout(storageKey, items));
  const itemSignature = items.map(item => `${item.id}:${item.defaultSpan || 1}`).join('|');
  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

  useEffect(() => {
    setLayout(currentLayout => reconcileLayout(currentLayout, items));
  }, [itemSignature]);

  useEffect(() => {
    persistLayout(storageKey, layout);
  }, [layout, storageKey]);

  const orderedItems = useMemo(
    () => layout
      .map(entry => {
        const item = itemsById.get(entry.id);
        if (!item) return null;

        return {
          ...item,
          span: normalizeSpan(entry.span, item.defaultSpan),
          collapsed: Boolean(entry.collapsed ?? item.defaultCollapsed),
        };
      })
      .filter(Boolean),
    [itemsById, layout],
  );

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    setLayout(currentLayout => reorder(
      currentLayout,
      result.source.index,
      result.destination.index,
    ));
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

  const toggleItem = useCallback((id) => {
    setLayout(currentLayout => currentLayout.map(layoutItem => (
      layoutItem.id === id
        ? { ...layoutItem, collapsed: !layoutItem.collapsed }
        : layoutItem
    )));
  }, []);

  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.removeItem(storageKey);
    }

    setLayout(createDefaultLayout(items));
  }, [items, storageKey]);

  const gridStyle = desktopColumns
    ? undefined
    : { gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))` };

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
              className="gap-2 rounded-md"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isEditing ? 'Готово' : 'Настроить'}
            </Button>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`${storageKey || 'adaptive'}-grid`} direction="horizontal">
            {(droppableProvided, droppableSnapshot) => (
              <div
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={cn(
                  'grid items-start gap-3 transition-colors',
                  desktopColumns === 3 && 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
                  droppableSnapshot.isDraggingOver && 'rounded-lg bg-primary/5',
                )}
                style={gridStyle}
              >
                {orderedItems.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={item.id}
                    index={index}
                    isDragDisabled={!isEditing}
                  >
                    {(draggableProvided, draggableSnapshot) => (
                      <AdaptiveGridItem
                        item={item}
                        isEditing={isEditing}
                        draggableProvided={draggableProvided}
                        draggableSnapshot={draggableSnapshot}
                        resizeItem={resizeItem}
                        toggleItem={toggleItem}
                      />
                    )}
                  </Draggable>
                ))}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </TooltipProvider>
  );
}
