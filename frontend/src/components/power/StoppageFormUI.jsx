import { useCallback, useLayoutEffect, useRef } from 'react';

export function StoppageLabel({ children, required = false, highlight = false }) {
  return (
    <label className={`mb-1.5 block text-xs font-semibold ${highlight ? 'text-orange-600' : 'text-gray-700'}`}>
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border bg-white py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2';

export function StoppageInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
  highlight = false,
  step,
}) {
  return (
    <div>
      <StoppageLabel required={required} highlight={highlight}>{label}</StoppageLabel>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        step={step}
        className={`${inputBase} px-3 ${
          highlight
            ? 'border-orange-300 focus:border-orange-400 focus:ring-orange-200'
            : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
        }`}
      />
    </div>
  );
}

export function StoppageSelect({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  icon: Icon,
  iconClassName = 'text-blue-500',
}) {
  return (
    <div>
      <StoppageLabel required={required}>{label}</StoppageLabel>
      <div className="relative">
        {Icon ? (
          <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${iconClassName}`}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className={`${inputBase} appearance-none border-gray-200 pl-10 pr-10 focus:border-blue-500 focus:ring-blue-500/20`}
        >
          {options.map((opt) => (
            <option key={opt || '__empty'} value={opt}>
              {opt || '— Select —'}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
      </div>
    </div>
  );
}

const SPECIFY_MAX_ROWS = 3;
export const SPECIFY_MAX_LENGTH = 100;

/** Auto-growing textarea: 1 row up to 3 rows, then scroll. */
export function StoppageSpecifyArea({
  label,
  name,
  value,
  onChange,
  required = false,
  placeholder = '',
  maxLength = SPECIFY_MAX_LENGTH,
}) {
  const ref = useRef(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    const minHeight = lineHeight + padding;
    const maxHeight = lineHeight * SPECIFY_MAX_ROWS + padding;
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  const length = (value ?? '').length;

  return (
    <div>
      <StoppageLabel required={required} highlight>{label}</StoppageLabel>
      <textarea
        ref={ref}
        name={name}
        value={value}
        rows={1}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e);
          syncHeight();
        }}
        className={`${inputBase} resize-none overflow-hidden border-orange-300 px-3 py-2 leading-5 focus:border-orange-400 focus:ring-orange-200`}
      />
      <p className="mt-1 text-right text-xs text-gray-400">
        {length}/{maxLength}
      </p>
    </div>
  );
}

export function StoppageRemarkArea({
  name,
  value,
  onChange,
  maxLength = 150,
  minLength = 20,
  placeholder = 'Provide brief details about the stoppage.',
}) {
  const length = (value ?? '').length;
  const belowMin = length < minLength;

  return (
    <div>
      <StoppageLabel required>General remarks</StoppageLabel>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={4}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`${inputBase} resize-none border-gray-200 px-3 focus:border-blue-500 focus:ring-blue-500/20`}
      />
      <p className={`mt-1 text-right text-xs ${belowMin ? 'font-medium text-red-600' : 'text-gray-400'}`}>
        {length}/{maxLength}
      </p>
    </div>
  );
}
