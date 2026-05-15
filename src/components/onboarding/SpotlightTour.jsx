import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SPOTLIGHT_PADDING = 10;
const CARD_WIDTH = 360;
const CARD_GAP = 16;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSpotlightRect(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: clamp(rect.top - SPOTLIGHT_PADDING, 8, window.innerHeight),
    left: clamp(rect.left - SPOTLIGHT_PADDING, 8, window.innerWidth),
    width: Math.min(rect.width + SPOTLIGHT_PADDING * 2, window.innerWidth - 16),
    height: Math.min(rect.height + SPOTLIGHT_PADDING * 2, window.innerHeight - 16),
  };
}

function getFallbackRect() {
  return {
    top: Math.round(window.innerHeight * 0.24),
    left: Math.round(window.innerWidth * 0.12),
    width: Math.round(window.innerWidth * 0.76),
    height: Math.round(window.innerHeight * 0.28),
  };
}

function getCardStyle(rect) {
  const safeRect = rect || getFallbackRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(CARD_WIDTH, viewportWidth - 24);
  const left = clamp(safeRect.left, 12, viewportWidth - width - 12);
  const belowTop = safeRect.top + safeRect.height + CARD_GAP;
  const aboveTop = safeRect.top - CARD_GAP;

  if (belowTop + 210 <= viewportHeight) {
    return { left, top: belowTop, width };
  }

  if (aboveTop >= 210) {
    return { left, bottom: viewportHeight - aboveTop, width };
  }

  return {
    left: clamp(safeRect.left + safeRect.width + CARD_GAP, 12, viewportWidth - width - 12),
    top: clamp(safeRect.top, 12, viewportHeight - 230),
    width,
  };
}

function DimLayer({ rect }) {
  const safeRect = rect || getFallbackRect();
  const topHeight = Math.max(0, safeRect.top);
  const bottomTop = safeRect.top + safeRect.height;
  const leftWidth = Math.max(0, safeRect.left);
  const rightLeft = safeRect.left + safeRect.width;

  return (
    <>
      <div className="fixed left-0 top-0 z-[70] bg-black/65" style={{ width: '100vw', height: topHeight }} />
      <div className="fixed left-0 z-[70] bg-black/65" style={{ top: bottomTop, width: '100vw', bottom: 0 }} />
      <div className="fixed left-0 z-[70] bg-black/65" style={{ top: safeRect.top, width: leftWidth, height: safeRect.height }} />
      <div className="fixed right-0 z-[70] bg-black/65" style={{ top: safeRect.top, left: rightLeft, height: safeRect.height }} />
      <div
        className="pointer-events-none fixed z-[71] rounded-lg border-2 border-primary bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.45),0_0_32px_rgba(154,52,18,0.38)]"
        style={{
          top: safeRect.top,
          left: safeRect.left,
          width: safeRect.width,
          height: safeRect.height,
        }}
      />
    </>
  );
}

export default function SpotlightTour({
  steps,
  open,
  onComplete,
  onSkip,
  initialStep = 0,
  isBusy = false,
}) {
  const [activeIndex, setActiveIndex] = useState(initialStep);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const activeStep = steps[activeIndex];
  const isLastStep = activeIndex === steps.length - 1;

  const updateRect = useCallback(() => {
    if (!open || !activeStep?.selector) {
      setRect(null);
      return;
    }

    setRect(getSpotlightRect(document.querySelector(activeStep.selector)));
  }, [activeStep?.selector, open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(initialStep);
  }, [initialStep, open]);

  useEffect(() => {
    if (!open || !activeStep?.selector) return undefined;

    const element = document.querySelector(activeStep.selector);
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
    updateRect();
    const timeoutId = window.setTimeout(updateRect, 320);
    return () => window.clearTimeout(timeoutId);
  }, [activeStep?.selector, open, updateRect]);

  useEffect(() => {
    if (!open) return undefined;

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, updateRect]);

  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
  }, [activeIndex, open]);

  const cardStyle = useMemo(() => {
    if (!open) return {};
    return getCardStyle(rect);
  }, [open, rect]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
      return;
    }
    setActiveIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handlePrevious = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onSkip?.();
    }
    if (event.key === 'ArrowRight') {
      handleNext();
    }
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    }
  };

  if (!open || !activeStep || steps.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      <DimLayer rect={rect} />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-tour-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed z-[72] rounded-lg border border-border bg-card p-4 text-card-foreground shadow-warm-lg outline-none"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-primary">
              Шаг {activeIndex + 1} из {steps.length}
            </p>
            <h2 id="spotlight-tour-title" className="mt-1 text-base font-semibold leading-snug text-foreground">
              {activeStep.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Пропустить обучение"
            onClick={onSkip}
            disabled={isBusy}
            className="h-8 w-8 flex-shrink-0 rounded-md"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {activeStep.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={activeIndex === 0 || isBusy}
            className="rounded-md"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>

          <div className="flex items-center gap-1">
            {steps.map((step, index) => (
              <button
                key={step.selector || step.title}
                type="button"
                aria-label={`Перейти к шагу ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                disabled={isBusy}
                className={cn(
                  'h-2.5 w-2.5 rounded-full border border-primary/40 transition-colors',
                  index === activeIndex ? 'bg-primary' : 'bg-transparent hover:bg-primary/30',
                )}
              />
            ))}
          </div>

          <Button type="button" size="sm" onClick={handleNext} disabled={isBusy} className="rounded-md">
            {isLastStep ? (
              <>
                <Check className="h-4 w-4" />
                Завершить
              </>
            ) : (
              <>
                Далее
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
