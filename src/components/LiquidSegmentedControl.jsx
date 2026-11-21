import { useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const variants = {
  light: {
    track: 'bg-[#EAEAE6]/75 backdrop-blur-md border border-black/[0.04] p-1',
    pill: 'bg-white/90 backdrop-blur-xl rounded-full border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,1)]',
    active: 'text-[#1E2421] font-semibold',
    inactive: 'text-neutral-500',
  },
  dark: {
    track: 'bg-[#1E2421]/85 backdrop-blur-2xl border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] p-1.5',
    pill: 'bg-white/[0.14] backdrop-blur-xl rounded-full border border-white/25 shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.35)]',
    active: 'text-[#CBE896] font-semibold',
    inactive: 'text-white/65',
  },
};

export default function LiquidSegmentedControl({
  options,
  value,
  onChange,
  variant = 'light',
  className = '',
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const selectedRef = useRef(options.findIndex((option) => option.value === value));
  const [position, setPosition] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = options.findIndex((option) => option.value === value);
  const style = variants[variant] ?? variants.light;

  useEffect(() => {
    selectedRef.current = activeIndex;
    if (!draggingRef.current && activeIndex >= 0) setPosition(activeIndex);
  }, [activeIndex]);

  const selectIndex = (index) => {
    const nextIndex = clamp(index, 0, options.length - 1);
    if (nextIndex === selectedRef.current) return;
    selectedRef.current = nextIndex;
    onChange(options[nextIndex].value);
  };

  const getPosition = (clientX) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !options.length) return 0;
    return clamp(((clientX - bounds.left) / bounds.width) * options.length - 0.5, 0, options.length - 1);
  };

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    selectedRef.current = activeIndex;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const nextPosition = getPosition(event.clientX);
    setPosition(nextPosition);
    selectIndex(Math.round(nextPosition));
  };

  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;
    const nextPosition = getPosition(event.clientX);
    setPosition(nextPosition);
    selectIndex(Math.round(nextPosition));
  };

  const finishDrag = (event) => {
    if (!draggingRef.current) return;
    const nextPosition = getPosition(event.clientX);
    const nextIndex = Math.round(nextPosition);
    setPosition(nextIndex);
    selectIndex(nextIndex);
    draggingRef.current = false;
    setIsDragging(false);
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
    trackRef.current?.querySelector(`[data-segment-index="${nextIndex}"]`)?.focus();
  };

  if (!options.length) return null;

  return (
    <div
      role="tablist"
      className={`relative flex touch-none select-none items-stretch rounded-full ${style.track} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div ref={trackRef} className="relative flex w-full">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-0 ${style.pill} ${activeIndex < 0 ? 'opacity-0' : ''} ${isDragging ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'}`}
          style={{
            width: `${100 / options.length}%`,
            transform: `translateX(${position * 100}%) scale(${isDragging ? (variant === 'dark' ? '1.05' : '1.04') : '1'})`,
          }}
        />
        {options.map((option, index) => {
          const Icon = option.icon;
          const active = index === activeIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              data-segment-index={index}
              onClick={() => selectIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full ${variant === 'dark' ? 'px-0 text-[9px]' : 'px-1 text-[11px]'} py-2 leading-none transition-colors duration-200 ${Icon ? 'flex-col gap-1' : 'flex-row gap-1.5'} ${active ? style.active : style.inactive}`}
            >
              {Icon && <Icon aria-hidden="true" size={15} strokeWidth={2} className="shrink-0" />}
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
