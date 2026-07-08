import { createContext, useContext, useEffect, useState } from 'react';
import {
  MdChatBubbleOutline,
  MdExpandMore,
  MdRefresh,
  MdSave,
} from 'react-icons/md';
import FormPageHeader from '../FormPageHeader';
import Spinner from '../Spinner';

const CollapseContext = createContext(false);

export function PowerFormPage({
  children,
  title,
  subtitle,
  onClear,
  submitLabel = 'Submit',
  submitting = false,
  formId = 'power-logbook-form',
  formKey,
  fallbackTitle,
}) {
  return (
    <main className="min-h-screen bg-slate-50/90 pb-12">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {formKey ? (
          <FormPageHeader formKey={formKey} fallbackTitle={fallbackTitle || title} />
        ) : null}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={onClear} className="btn-secondary gap-2">
              <MdRefresh className="h-4 w-4" />
              Reset
            </button>
            <button
              type="submit"
              form={formId}
              disabled={submitting}
              className="btn-primary gap-2 px-6"
            >
              {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
              {submitting ? 'Submitting…' : submitLabel}
            </button>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

export function PowerDateCard({ label = 'Report Date:', value, onChange, name = 'date', required = false }) {
  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </h3>
      <input
        type="date"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}

export function MillDateShiftCard({
  dateValue,
  shiftValue,
  onChange,
  shifts = ['A', 'B', 'C'],
  dateName = 'date',
  shiftName = 'shift',
}) {
  const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-700';
  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:max-w-xs sm:text-sm';

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
        <div>
          <label htmlFor={dateName} className={labelClass}>
            Report Date:
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            id={dateName}
            type="date"
            name={dateName}
            value={dateValue}
            onChange={onChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={shiftName} className={labelClass}>
            Shift:
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            id={shiftName}
            name={shiftName}
            value={shiftValue}
            onChange={onChange}
            required
            className={inputClass}
          >
            <option value="">— Select —</option>
            {shifts.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function PowerFormCard({
  icon: Icon,
  title,
  subtitle,
  children,
  collapseAll = false,
  onToggleCollapseAll,
}) {
  return (
    <CollapseContext.Provider value={collapseAll}>
      <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {subtitle ? (
                <p className="text-xs text-gray-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {onToggleCollapseAll ? (
            <button
              type="button"
              onClick={onToggleCollapseAll}
              className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {collapseAll ? 'Expand All' : 'Collapse All'}
            </button>
          ) : null}
        </div>
        <div className="px-5 py-1">{children}</div>
      </div>
    </CollapseContext.Provider>
  );
}

const ICON_STYLES = {
  green: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  pink: 'bg-pink-50 text-pink-600',
  teal: 'bg-teal-50 text-teal-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function PowerCategoryRow({
  icon: Icon,
  tone = 'blue',
  title,
  children,
  defaultOpen = true,
  columns = 'sm:grid-cols-2 lg:grid-cols-4',
}) {
  const collapseAll = useContext(CollapseContext);
  const [open, setOpen] = useState(defaultOpen);

  // Sync with Collapse All / Expand All, but allow manual toggle in either mode.
  useEffect(() => {
    setOpen(!collapseAll);
  }, [collapseAll]);

  const iconClass = ICON_STYLES[tone] || ICON_STYLES.blue;

  return (
    <div className="border-b border-gray-100 py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        {Icon ? (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <span className="flex-1 text-sm font-semibold text-gray-900">{title}</span>
        <MdExpandMore
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className={`mt-4 grid grid-cols-1 gap-4 ${columns} sm:pl-[52px]`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function PowerMetricField({
  label,
  name,
  value,
  onChange,
  placeholder = 'Enter value',
  type = 'number',
  step = '0.01',
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
      </label>
      <input
        id={name}
        type={type}
        step={type === 'number' ? step : undefined}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}

export function PowerSelectField({ label, name, value, onChange, options, required = false }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((opt) => (
          <option key={opt || '__empty'} value={opt}>
            {opt || '— Select —'}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PowerRemarkBlock({
  name = 'remark',
  value,
  onChange,
  required = false,
  minLength,
  maxLength = 500,
  placeholder = 'Enter any remarks or observations…',
  showCounter = true,
  label = 'General remarks:',
}) {
  const length = (value ?? '').length;
  const belowMin = minLength != null && length < minLength;

  return (
    <div className="border-t border-gray-100 py-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <MdChatBubbleOutline className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={name} className="mb-2 block text-sm font-semibold text-gray-900">
            {label}
            {required ? <span className="ml-0.5 text-red-500">*</span> : null}
            {minLength != null && maxLength ? (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({minLength}–{maxLength} characters)
              </span>
            ) : null}
          </label>
          <textarea
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            rows={4}
            required={required}
            maxLength={maxLength}
            placeholder={placeholder}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {showCounter ? (
            <p className={`mt-1 text-right text-xs ${belowMin ? 'font-medium text-red-600' : 'text-gray-400'}`}>
              {length}/{maxLength}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PowerStageLabel({ children }) {
  return (
    <p className="col-span-full mb-1 mt-2 text-sm font-semibold text-gray-700">
      {children}
    </p>
  );
}

export function usePowerCollapseAll() {
  const [collapseAll, setCollapseAll] = useState(false);
  return {
    collapseAll,
    toggleCollapseAll: () => setCollapseAll((v) => !v),
  };
}
