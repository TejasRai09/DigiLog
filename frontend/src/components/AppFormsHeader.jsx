import { MdApps } from 'react-icons/md';
import { withoutGsmaLabel } from '../utils/displayLabels';
import AppPageHeader from './AppPageHeader';

/**
 * App title row for pages that list forms in a table (below breadcrumb).
 */
const AppFormsHeader = ({
  name,
  description = '',
  icon: Icon = MdApps,
  color = '#2563EB',
  className = 'mb-8',
  bleed = true,
}) => {
  const title = withoutGsmaLabel(name);
  if (!title) return null;

  const body = (
    <div className="flex items-center gap-4">
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm font-medium text-slate-700">
            {typeof description === 'string' ? withoutGsmaLabel(description) : description}
          </p>
        )}
      </div>
    </div>
  );

  if (!bleed) {
    return <div className={className}>{body}</div>;
  }

  return <AppPageHeader className={className}>{body}</AppPageHeader>;
};

export default AppFormsHeader;
