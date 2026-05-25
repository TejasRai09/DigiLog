import { Link } from 'react-router-dom';
import { MdChevronRight, MdHome } from 'react-icons/md';
import { withoutGsmaLabel } from '../utils/displayLabels';

/**
 * Horizontal breadcrumb trail. Last item is the current page (not linked).
 * @param {{ label: string, to?: string }[]} items
 */
const AppBreadcrumb = ({ items, className = 'mb-6' }) => {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-0.5 text-sm text-gray-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = withoutGsmaLabel(item.label) || '…';
          const showLink = Boolean(item.to) && !isLast;

          return (
            <li key={`${label}-${index}`} className="flex items-center gap-0.5 min-w-0">
              {index > 0 && (
                <MdChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
              )}
              {showLink ? (
                <Link
                  to={item.to}
                  className="hover:text-gray-900 transition-colors truncate max-w-[10rem] sm:max-w-xs md:max-w-none"
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
                    isLast ? 'font-medium text-gray-900' : ''
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
};

export default AppBreadcrumb;
