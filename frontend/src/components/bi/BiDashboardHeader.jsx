import { MdInsights } from 'react-icons/md';
import { useFormMeta } from '../../hooks/useFormMeta';
import { withoutGsmaLabel } from '../../utils/displayLabels';

/**
 * Dashboard title row for BI analytics pages (below breadcrumb).
 */
const BiDashboardHeader = ({
  formKey,
  fallbackTitle = 'Dashboard',
  subtitle = '',
  icon: Icon = MdInsights,
  color = '#6366f1',
  isDarkMode = false,
  className = 'mb-4',
}) => {
  const { name, loading } = useFormMeta(formKey, { fallbackTitle });
  const title = withoutGsmaLabel((loading && !name ? fallbackTitle : name) || fallbackTitle);

  const titleClass = isDarkMode ? 'text-slate-100' : 'text-gray-900';
  const subtitleClass = isDarkMode ? 'text-slate-400' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <h1 className={`text-2xl font-bold tracking-tight ${titleClass}`}>{title}</h1>
        {subtitle && (
          <p className={`text-sm mt-0.5 ${subtitleClass}`}>
            {typeof subtitle === 'string' ? subtitle : subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default BiDashboardHeader;
