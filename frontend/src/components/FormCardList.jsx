import { MdDownload, MdOpenInNew, MdTableChart } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import {
  getDisplayColumns,
  headerLabel,
  formatRecordCellForDisplay,
} from '../config/formColumnSchemas';
import { withoutGsmaLabel } from '../utils/displayLabels';
import { isSimpleOpenForm, openFormButtonLabel, openFormTarget } from '../utils/formTableNav';

const escapeCsvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

function downloadCSV(filename, rows, columns, formKey = null) {
  if (!rows.length) {
    toast.error('No data to download.');
    return;
  }
  const headerLine = columns.map(headerLabel).map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) =>
    columns.map(({ dbKey }) =>
      escapeCsvCell(formatRecordCellForDisplay(dbKey, row[dbKey], formKey)),
    ).join(','),
  );
  const csv = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FormCardList({
  forms,
  navigate,
  appId = null,
  returnTo = null,
  onViewData,
}) {
  const downloadFormCsv = async (form) => {
    const tid = toast.loading('Preparing CSV…');
    try {
      const { data } = await api.get(`/forms/${form.formKey}/records?page=1&limit=10000`);
      const cols = getDisplayColumns(form.formKey, data.records?.[0] ?? null);
      downloadCSV(`${form.formKey}.csv`, data.records, cols, form.formKey);
      toast.success('Downloaded!', { id: tid });
    } catch {
      toast.error('Download failed.', { id: tid });
    }
  };

  return (
    <ul className="space-y-4 p-4 sm:p-5">
      {forms.map((form, idx) => {
        const showDataActions = !isSimpleOpenForm(form);
        return (
          <li
            key={form._id ?? form.id ?? form.formKey}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Form {idx + 1}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                Active
              </span>
            </div>

            <h3 className="text-base font-bold leading-snug text-slate-900">
              {withoutGsmaLabel(form.name)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {form.description || 'Digital operational form mapped to your account.'}
            </p>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => openFormTarget(navigate, form, { appId, returnTo })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {openFormButtonLabel(form)}
                <MdOpenInNew className="h-4 w-4 shrink-0" aria-hidden />
              </button>

              {showDataActions && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onViewData(form)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    <MdTableChart className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    View Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFormCsv(form)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    <MdDownload className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    Excel Download
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
