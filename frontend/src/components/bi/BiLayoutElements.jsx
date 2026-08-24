import React from 'react';
import { MdLightMode, MdDarkMode } from 'react-icons/md';

function formatMetricValue(value) {
  if (value === undefined || value === null || value === '') return '';
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString('en-IN');
  return String(value);
}

/** Shrink display font as digit count grows so values stay inside the box. */
function metricValueFontClass(display) {
  const len = String(display).replace(/,/g, '').length;
  if (len <= 2) return 'text-3xl sm:text-4xl';
  if (len <= 3) return 'text-2xl sm:text-3xl';
  if (len <= 4) return 'text-xl sm:text-2xl';
  if (len <= 5) return 'text-lg sm:text-xl';
  return 'text-sm sm:text-base';
}

export function BiKeyMetricBox({ value, title, subtitle, isDarkMode, tooltip, compact = false }) {
  if (value === undefined || value === null) return null;
  const display = formatMetricValue(value);
  if (!display) return null;

  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border text-center ${
        compact
          ? 'min-w-[3.25rem] max-w-[5rem] px-1.5 py-0.5 sm:min-w-[3.5rem]'
          : 'min-w-[4.5rem] max-w-[7.5rem] px-2 py-1.5 sm:min-w-[5rem] sm:max-w-[8.5rem]'
      } ${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-100'}`}
      title={tooltip}
    >
      <span
        className={`max-w-full truncate font-black leading-none tabular-nums ${
          compact ? 'text-base sm:text-lg' : metricValueFontClass(display)
        } ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
      >
        {display}
      </span>
      <span className={`max-w-full truncate font-bold leading-tight ${compact ? 'mt-0.5 text-[9px]' : 'mt-1 text-[11px]'} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {title}
      </span>
      {subtitle && !compact && (
        <span className={`max-w-full truncate text-[9px] font-semibold leading-tight ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

export function BiFilterBarLayout({ isDarkMode, setIsDarkMode, children, compact = false, alignEnd = false }) {
  return (
    <div className={`flex min-w-0 flex-col px-0.5 ${alignEnd ? 'ml-auto w-auto max-w-full' : 'w-full'} ${compact ? 'gap-0 py-0' : 'gap-2 py-1 lg:py-1.5'}`}>
        <div
          className={`distillery-filter-bar relative z-20 flex min-w-0 max-w-full flex-wrap items-center overflow-visible border shadow-sm backdrop-blur-md ${
            alignEnd ? 'ml-auto w-auto justify-end' : 'w-full lg:w-auto'
          } ${
            compact
              ? 'gap-1 rounded-lg p-1 sm:gap-1.5'
              : 'gap-2 rounded-2xl p-2 sm:gap-2.5 sm:p-2.5'
          } ${
            isDarkMode
              ? 'border-purple-500/30 bg-slate-800/80 shadow-purple-900/20'
              : 'border-purple-200 bg-white/80 shadow-purple-100/50'
          }`}
        >
          {setIsDarkMode && (
            <>
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`shrink-0 rounded-lg border transition-colors ${
                  compact ? 'p-1' : 'rounded-xl p-1.5 sm:p-2'
                } ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                {isDarkMode ? <MdLightMode className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : <MdDarkMode className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
              </button>

              <div className={`mx-0.5 hidden w-px shrink-0 sm:block ${compact ? 'h-4' : 'h-6'} ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />
            </>
          )}

          {children}
      </div>
    </div>
  );
}
