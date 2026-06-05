import { useNavigate } from 'react-router-dom';
import { MdOpenInNew } from 'react-icons/md';
import { biDashboardPath } from '../../config/biDashboardRoutes';
import { withoutGsmaLabel } from '../../utils/displayLabels';

const DIVISION_BY_FORM_KEY = {
  bi_distillery_operations: 'Distillery Div',
  bi_milling_operations: 'Milling Div',
};

function divisionLabel(form) {
  if (form?.formKey && DIVISION_BY_FORM_KEY[form.formKey]) {
    return DIVISION_BY_FORM_KEY[form.formKey];
  }
  const name = form?.name || '';
  if (/distillery/i.test(name)) return 'Distillery Div';
  if (/mill/i.test(name)) return 'Milling Div';
  return 'Analytics';
}

export default function BiDashboardCardList({ forms, appId }) {
  const navigate = useNavigate();

  const openDashboard = (form) => {
    const path = biDashboardPath(form.formKey);
    if (!path) return;
    const state = {};
    if (appId != null && appId !== '') {
      state.appId = String(appId);
      state.returnTo = '/bi';
    }
    navigate(path, { state: Object.keys(state).length ? state : undefined });
  };

  return (
    <ul className="space-y-4 p-4 sm:p-5">
      {forms.map((form, idx) => (
        <li
          key={form._id ?? form.id ?? form.formKey}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" aria-hidden />
              Dashboard {idx + 1}
            </span>
            <span className="shrink-0 text-xs font-medium text-slate-500">{divisionLabel(form)}</span>
          </div>

          <h3 className="text-base font-bold leading-snug text-slate-900">
            {withoutGsmaLabel(form.name)}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {form.description || 'Analytics dashboard mapped to your account.'}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-500">Access: Forms Hub Link</span>
            <button
              type="button"
              onClick={() => openDashboard(form)}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 sm:w-auto"
            >
              Open Dashboard
              <MdOpenInNew className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
