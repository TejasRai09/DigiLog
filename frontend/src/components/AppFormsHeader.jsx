import { MdApps } from 'react-icons/md';
import { withoutGsmaLabel } from '../utils/displayLabels';

/**
 * App title row for pages that list forms in a table (below breadcrumb).
 */
const AppFormsHeader = ({
  name,
  description = '',
  icon: Icon = MdApps,
  color = '#2563EB',
  className = 'mb-8',
}) => {
  const title = withoutGsmaLabel(name);
  if (!title) return null;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">
            {typeof description === 'string' ? withoutGsmaLabel(description) : description}
          </p>
        )}
      </div>
    </div>
  );
};

export default AppFormsHeader;
