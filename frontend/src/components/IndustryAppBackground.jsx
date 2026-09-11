import { useEffect } from 'react';
import { INDUSTRY_APP_BG } from '../config/appBackground';

/**
 * Fixed full-bleed industry background (same asset as BI Control Tower).
 * Applied once for the logged-in app so every page shares it.
 */
export default function IndustryAppBackground() {
  useEffect(() => {
    document.documentElement.classList.add('has-industry-bg');
    return () => {
      document.documentElement.classList.remove('has-industry-bg');
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-slate-100" />
      <img
        src={INDUSTRY_APP_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100/75 via-white/70 to-slate-100/85" />
    </div>
  );
}
