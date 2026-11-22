import { useEffect, useState } from 'react';
import { currency } from '../utils/format.js';

export default function AnimatedCurrency({ amount, className = '' }) {
  const target = Number(amount) || 0;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const startValue = displayed;
    const startedAt = performance.now();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplayed(target);
      return undefined;
    }

    let frame;
    const animate = (now) => {
      const progress = Math.min((now - startedAt) / 600, 1);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayed(startValue + (target - startValue) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  return <span className={`money ${className}`}>{currency(Math.round(displayed))}</span>;
}
