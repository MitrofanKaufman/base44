import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const MASONRY_ROW_HEIGHT = 8;
export const MASONRY_GAP = 12;

function resolveNodeHeight(node) {
  if (!node) return 0;
  return node.getBoundingClientRect().height || node.scrollHeight || 0;
}

export function getMasonryRowSpan(height, rowHeight = MASONRY_ROW_HEIGHT, gap = MASONRY_GAP) {
  const safeHeight = Number(height) || 0;
  if (safeHeight <= 0) return 1;
  return Math.max(1, Math.ceil((safeHeight + gap) / (rowHeight + gap)));
}

export function useMasonryGrid({
  enabled = true,
  itemIds = [],
  rowHeight = MASONRY_ROW_HEIGHT,
  gap = MASONRY_GAP,
} = {}) {
  const elementsRef = useRef(new Map());
  const observerRef = useRef(null);
  const [rowSpans, setRowSpans] = useState({});
  const itemSignature = itemIds.join('|');

  const setItemSpan = useCallback((id, node) => {
    if (!enabled || !id || !node) return;
    const span = getMasonryRowSpan(resolveNodeHeight(node), rowHeight, gap);

    setRowSpans(current => (
      current[id] === span
        ? current
        : { ...current, [id]: span }
    ));
  }, [enabled, gap, rowHeight]);

  const registerItem = useCallback((id, node) => {
    const previousNode = elementsRef.current.get(id);
    if (previousNode && observerRef.current) {
      observerRef.current.unobserve(previousNode);
    }

    if (!node) {
      elementsRef.current.delete(id);
      setRowSpans(current => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }

    elementsRef.current.set(id, node);
    node.dataset.masonryGridItem = id;
    setItemSpan(id, node);

    if (observerRef.current) {
      observerRef.current.observe(node);
    }
  }, [setItemSpan]);

  useLayoutEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') {
      setRowSpans({});
      return undefined;
    }

    const observer = new ResizeObserver(entries => {
      setRowSpans(current => {
        let changed = false;
        const next = { ...current };

        entries.forEach(entry => {
          const id = entry.target.dataset.masonryGridItem;
          if (!id) return;
          const borderBox = Array.isArray(entry.borderBoxSize)
            ? entry.borderBoxSize[0]
            : entry.borderBoxSize;
          const height = borderBox?.blockSize || resolveNodeHeight(entry.target);
          const span = getMasonryRowSpan(height, rowHeight, gap);

          if (next[id] !== span) {
            next[id] = span;
            changed = true;
          }
        });

        return changed ? next : current;
      });
    });

    observerRef.current = observer;
    elementsRef.current.forEach((node, id) => {
      node.dataset.masonryGridItem = id;
      observer.observe(node);
      setItemSpan(id, node);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [enabled, gap, itemSignature, rowHeight, setItemSpan]);

  useEffect(() => {
    const activeIds = new Set(itemIds);
    setRowSpans(current => {
      let changed = false;
      const next = {};

      Object.entries(current).forEach(([id, span]) => {
        if (!activeIds.has(id)) {
          changed = true;
          return;
        }
        next[id] = span;
      });

      return changed ? next : current;
    });
  }, [itemSignature]);

  return {
    rowSpans,
    registerItem,
  };
}
