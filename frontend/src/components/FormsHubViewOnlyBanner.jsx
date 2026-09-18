import { useEffect } from 'react';
import { MdVisibility } from 'react-icons/md';
import useFormsHubViewOnly from '../hooks/useFormsHubViewOnly';

export const FORMS_HUB_VIEW_ONLY_MESSAGE =
  'View only — you can see this data but cannot submit or edit.';

export default function FormsHubViewOnlyBanner({ className = 'mb-4' }) {
  const viewOnly = useFormsHubViewOnly();

  useEffect(() => {
    if (!viewOnly) return undefined;
    document.body.classList.add('forms-hub-view-only');
    return () => document.body.classList.remove('forms-hub-view-only');
  }, [viewOnly]);

  if (!viewOnly) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ${className}`}
      role="status"
    >
      <MdVisibility className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <span>{FORMS_HUB_VIEW_ONLY_MESSAGE}</span>
    </div>
  );
}
