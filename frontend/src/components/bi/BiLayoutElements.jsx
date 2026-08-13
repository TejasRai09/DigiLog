import React from 'react';
import { MdDashboard, MdTableChart, MdLightMode, MdDarkMode } from 'react-icons/md';

export function BiKeyMetricBox({ value, title, subtitle, isDarkMode, tooltip }) {
  if (value === undefined || value === null) return null;
  return (
    <div
      className={`flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center sm:w-[4.75rem] ${
        isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-100'
      }`}
      title={tooltip}
    >
      <span
        className={`text-3xl font-black leading-none tabular-nums sm:text-4xl ${
          isDarkMode ? 'text-slate-100' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
      <span className={`mt-1 text-[8px] font-bold leading-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {title}
      </span>
      {subtitle && (
        <span className={`max-w-full truncate text-[7px] font-semibold leading-tight ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

export function BiViewTabs({ activeTab, setActiveTab, isDarkMode }) {
  const textClasses = isDarkMode 
    ? { muted: 'text-slate-500', hover: 'hover:text-slate-300' }
    : { muted: 'text-slate-400', hover: 'hover:text-slate-600' };

  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
          activeTab === 'dashboard'
            ? 'border-blue-500 text-blue-500'
            : `border-transparent ${textClasses.muted} ${textClasses.hover}`
        }`}
      >
        <MdDashboard className="h-3.5 w-3.5" />
        Visual Dashboard
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('table')}
        className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-black transition-colors ${
          activeTab === 'table'
            ? 'border-blue-500 text-blue-500'
            : `border-transparent ${textClasses.muted} ${textClasses.hover}`
        }`}
      >
        <MdTableChart className="h-3.5 w-3.5" />
        Raw Data Table
      </button>
    </div>
  );
}

export function BiFilterBarLayout({ isDarkMode, setIsDarkMode, children }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 px-0.5 py-1 lg:w-auto lg:py-1.5">
        <div
          className={`distillery-filter-bar relative flex w-full lg:w-auto min-w-0 max-w-full items-center gap-2 overflow-x-hidden rounded-2xl border p-2 shadow-sm backdrop-blur-md sm:gap-2.5 sm:p-2.5 ${
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
                className={`shrink-0 rounded-xl border p-1.5 transition-colors sm:p-2 ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                {isDarkMode ? <MdLightMode className="h-4 w-4" /> : <MdDarkMode className="h-4 w-4" />}
              </button>

              <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />
            </>
          )}

          {children}
      </div>
    </div>
  );
}
