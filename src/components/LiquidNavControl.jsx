import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function LiquidNavControl({ options, value, onChange }) {
  const navRef = useRef(null);
  const rowRef = useRef(null);
  const draggingRef = useRef(false);
  const selectedRef = useRef(options.findIndex((option) => option.value === value));
  const [dimensions, setDimensions] = useState({ width: 0, tab: 0, left: 0 });
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((nextPosition) => setPosition(nextPosition), []);

  const measure = useCallback(() => {
    const navBounds = navRef.current?.getBoundingClientRect();
    const rowBounds = rowRef.current?.getBoundingClientRect();
    if (!navBounds || !rowBounds || !options.length) return;
    const tabWidth = rowBounds.width / options.length;
    const nextIndex = options.findIndex((option) => option.value === value);
    setDimensions({ width: rowBounds.width, tab: tabWidth, left: rowBounds.left - navBounds.left });
    if (!draggingRef.current && nextIndex >= 0) {
      selectedRef.current = nextIndex;
      updatePosition(nextIndex * tabWidth);
    }
  }, [options, updatePosition, value]);

  useEffect(() => {
    measure();
    const observer = typeof ResizeObserver !== 'undefined' && navRef.current
      ? new ResizeObserver(measure)
      : null;
    if (observer && navRef.current) observer.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const activeIndex = options.findIndex((option) => option.value === value);
  useEffect(() => {
    if (activeIndex < 0 || draggingRef.current) return;
    selectedRef.current = activeIndex;
    if (dimensions.tab) updatePosition(activeIndex * dimensions.tab);
  }, [activeIndex, dimensions.tab, updatePosition]);

  const selectIndex = useCallback((index, { keepPosition = false } = {}) => {
    const nextIndex = clamp(index, 0, options.length - 1);
    if (nextIndex === selectedRef.current) return;
    selectedRef.current = nextIndex;
    if (!keepPosition && dimensions.tab) updatePosition(nextIndex * dimensions.tab);
    onChange(options[nextIndex].value);
  }, [dimensions.tab, onChange, options, updatePosition]);

  const getPointerPosition = (clientX) => {
    const bounds = rowRef.current?.getBoundingClientRect();
    if (!bounds || !dimensions.tab) return { x: 0, index: 0 };
    const x = clamp(clientX - bounds.left - dimensions.tab / 2, 0, bounds.width - dimensions.tab);
    return { x, index: clamp(Math.round(x / dimensions.tab), 0, options.length - 1) };
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    draggingRef.current = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const next = getPointerPosition(event.clientX);
    updatePosition(next.x);
    selectIndex(next.index, { keepPosition: true });
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;
    const next = getPointerPosition(event.clientX);
    updatePosition(next.x);
    if (next.index !== selectedRef.current) selectIndex(next.index, { keepPosition: true });
  };

  const finishDrag = (event) => {
    if (!draggingRef.current) return;
    const next = getPointerPosition(event.clientX);
    draggingRef.current = false;
    setIsDragging(false);
    updatePosition(next.index * dimensions.tab);
    selectIndex(next.index);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectIndex(nextIndex);
    navRef.current?.querySelector(`[data-nav-index="${nextIndex}"]`)?.focus();
  };

  return (
    <div
      ref={navRef}
      role="tablist"
      aria-label="Navigasi utama"
      className={`nav-glass ${isDragging ? 'is-dragging' : ''}`}
      style={{
        '--x': `${position}px`,
        '--nav-row-left': `${dimensions.left}px`,
        '--nav-indicator-width': `${dimensions.tab}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div ref={rowRef} className="nav-tab-row">
        {options.map((option, index) => {
          const Icon = option.icon;
          const selected = index === activeIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selected}
              data-nav-index={index}
              onClick={() => selectIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`nav-tab ${selected ? 'is-selected' : ''}`}
            >
              {Icon && <Icon aria-hidden="true" size={15} strokeWidth={2} />}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className={`liquid-indicator ${activeIndex < 0 ? 'is-hidden' : ''}`}
        style={{
          width: 'var(--nav-indicator-width)',
          transform: 'translateX(var(--x))',
        }}
      />
    </div>
  );
}
