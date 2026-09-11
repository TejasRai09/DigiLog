import { Link } from 'react-router-dom';
import { MdChevronRight, MdHome } from 'react-icons/md';
import { withoutGsmaLabel } from '../utils/displayLabels';
import AppPageHeader from './AppPageHeader';

/**
 * Horizontal breadcrumb trail. Last item is the current page (not linked) unless `linkWhenLast`.
 * @param {{ label: string, to?: string, state?: object, linkWhenLast?: boolean }[]} items
 */
const AppBreadcrumb = ({ items, className = 'mb-6', bleed = true }) => {
  if (!items?.length) return null;

  const trail = (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = withoutGsmaLabel(item.label) || '…';
          const showLink = Boolean(item.to) && (!isLast || item.linkWhenLast);

          return (
            <li key={`${label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <MdChevronRight
                  className="h-5 w-5 shrink-0 text-slate-700"
                  aria-hidden
                />
              )}
              {showLink ? (
                <Link
                  to={item.to}
                  state={item.state}
                  className={`truncate max-w-[10rem] transition-colors hover:text-slate-950 sm:max-w-xs md:max-w-none ${
                    isLast
                      ? 'text-base font-bold text-slate-900'
                      : 'text-sm font-semibold text-slate-800'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <MdHome className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{label}</span>
                    </span>
                  ) : (
                    label
                  )}
                </Link>
              ) : (
                <span
                  className={`truncate max-w-[12rem] sm:max-w-xs md:max-w-none ${
                    isLast
                      ? 'text-base font-bold text-slate-900'
                      : 'text-sm font-semibold text-slate-800'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );

  if (!bleed) {
    return <div className={className}>{trail}</div>;
  }

  return <AppPageHeader className={className}>{trail}</AppPageHeader>;
};

export default AppBreadcrumb;
