import Spinner from '../Spinner';

/**
 * Primary/secondary action button with inline spinner while an API call runs.
 */
export default function BusyButton({
  busy = false,
  busyLabel = 'Please wait…',
  children,
  className = '',
  type = 'button',
  disabled = false,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner size="sm" /> : null}
      {busy ? busyLabel : children}
    </button>
  );
}
