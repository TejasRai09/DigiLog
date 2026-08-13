import { MdInsights, MdHome, MdChevronRight } from 'react-icons/md';
import { Link } from 'react-router-dom';

/**
 * Standardized dashboard header for all BI analytics pages.
 *
 * Layout: 
 *   [Breadcrumb: Dashboard > BI Control Tower]
 *   [icon square] [h1 title + subtitle]
 *
 * Props:
 *   title       – main heading text
 *   subtitle    – secondary descriptor text
 *   icon        – React icon component (defaults to MdInsights)
 *   iconColor   – hex background color for icon square
 *   isDarkMode  – boolean
 *   backTo      – link target (defaults to '/bi')
 *   backLabel   – label for back link (defaults to 'BI Control Tower')
 *   className   – extra className for root element
 */
const BiDashboardHeader = ({
  title = 'Dashboard',
  subtitle = '',
  icon: Icon = MdInsights,
  iconColor = '#6366f1',
  isDarkMode = false,
  backTo = '/bi',
  backLabel = 'BI Control Tower',
  className = '',
}) => {
  const headerClasses = isDarkMode ? 'text-slate-100' : 'text-slate-900';
  const subheadClasses = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {/* Breadcrumb Navigation */}
      <div className={`flex items-center gap-1 text-[13px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        <MdHome className="h-4 w-4" />
        <Link to="/" className={`transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#0056b3] hover:text-blue-800'}`}>
          Dashboard
        </Link>
        <MdChevronRight className="h-4 w-4 opacity-70" />
        <Link to={backTo} className={`transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-[#0056b3] hover:text-blue-800'}`}>
          {backLabel}
        </Link>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {/* Icon square */}
        <div
          className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-white shadow-md"
          style={{ backgroundColor: iconColor }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Title + subtitle */}
        <div className="min-w-0">
          <h1 className={`text-xl font-black tracking-tight sm:text-2xl ${headerClasses}`}>{title}</h1>
          {subtitle && (
            <p className={`text-[11px] font-bold leading-snug ${subheadClasses}`}>{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BiDashboardHeader;
