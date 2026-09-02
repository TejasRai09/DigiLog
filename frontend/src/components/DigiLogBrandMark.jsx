export const APP_VERSION = 'v1';

/** "DigiLog" title with small version label (e.g. v1). */
export function DigiLogTitle({
  className = '',
  titleClassName = '',
  versionClassName = '',
}) {
  return (
    <span className={`inline-flex items-baseline gap-0.5 ${className}`}>
      <span className={titleClassName}>DigiLog</span>
      <span
        className={`text-[0.62em] font-semibold leading-none text-slate-400 ${versionClassName}`}
        aria-label={`version ${APP_VERSION}`}
      >
        {APP_VERSION}
      </span>
    </span>
  );
}

const LOGO_SIZE_CLASS = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8 sm:h-9 sm:w-9',
  md: 'h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12',
  lg: 'h-20 w-20',
};

/**
 * DigiLog logo + optional title/tagline. Use wherever the app brand appears in the UI.
 */
export default function DigiLogBrandMark({
  size = 'md',
  showTagline = true,
  showTitle = true,
  hideTitleBelow = 'sm',
  titleTone = 'blue',
  taglineClassName = '',
  className = '',
  logoClassName = '',
  stacked = false,
}) {
  const titleToneClass = {
    blue: 'text-sm font-bold text-blue-700 sm:text-base',
    slate: 'truncate text-sm font-extrabold leading-none tracking-tight text-slate-900',
    white: 'text-2xl font-bold text-white',
  }[titleTone] || titleTone;

  const defaultTaglineClass = titleTone === 'white'
    ? 'mt-1 text-sm text-slate-300'
    : titleTone === 'slate'
      ? 'mt-0.5 hidden text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:block'
      : 'max-w-[8rem] truncate text-[10px] text-gray-500 sm:max-w-none sm:text-xs';

  const hideTitleClass = hideTitleBelow === 'sm'
    ? 'hidden sm:flex'
    : hideTitleBelow === 'none'
      ? 'flex'
      : 'hidden';

  const logoSize = LOGO_SIZE_CLASS[size] || LOGO_SIZE_CLASS.md;

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${stacked ? 'flex-col text-center' : ''} ${className}`}
    >
      <div className={`relative shrink-0 ${stacked ? 'mx-auto' : ''}`}>
        <img
          src="/logo.png"
          alt="DigiLog"
          className={`${logoSize} object-contain ${logoClassName}`}
          width={size === 'lg' ? 80 : 48}
          height={size === 'lg' ? 80 : 48}
          decoding="async"
        />
        {showTitle && hideTitleBelow === 'sm' && (
          <span className="absolute -bottom-0.5 -right-1 rounded bg-white/90 px-0.5 text-[8px] font-bold leading-none text-slate-400 sm:hidden">
            {APP_VERSION}
          </span>
        )}
      </div>

      {showTitle && (
        <div className={`min-w-0 flex-col text-left leading-tight ${hideTitleClass} ${stacked ? '!flex text-center' : ''}`}>
          <DigiLogTitle titleClassName={titleToneClass} versionClassName={titleTone === 'white' ? 'text-slate-400' : ''} />
          {showTagline && (
            <span className={taglineClassName || defaultTaglineClass}>
              Your digital logbook
            </span>
          )}
        </div>
      )}
    </div>
  );
}
