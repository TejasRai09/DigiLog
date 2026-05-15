import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdOpenInNew, MdTableChart, MdDownload,
  MdClose, MdChevronLeft, MdChevronRight,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';
import { getDisplayColumns, headingRuns, headerLabel, formatRecordCellForDisplay } from '../config/formColumnSchemas';
import { isHubFormKey, hubFormPath } from '../config/hubFormRoutes';
import { isBiDashboardFormKey, biDashboardPath } from '../config/biDashboardRoutes';

const escapeCsvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const downloadCSV = (filename, rows, columns, formKey = null) => {
  if (!rows.length) { toast.error('No data to download.'); return; }
  const headerLine = columns.map(headerLabel).map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) =>
    columns.map(({ dbKey }) =>
      escapeCsvCell(formatRecordCellForDisplay(dbKey, row[dbKey], formKey)),
    ).join(','),
  );
  const csv = [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── View Data Modal ──────────────────────────────────────────
const ViewDataModal = ({ form, onClose }) => {
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState(null);   // { total, records }
  const [loading, setLoading] = useState(false);
  const LIMIT = 20;

  const fetchPage = async (p) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(
        `/forms/${form.formKey}/records?page=${p}&limit=${LIMIT}`
      );
      setData(res);
      setPage(p);
    } catch {
      toast.error('Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  // Load first page on mount
  useEffect(() => { fetchPage(1); }, []);

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;
  const sample      = data?.records?.[0] ?? null;
  const columns     = getDisplayColumns(form.formKey, sample);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl flex flex-col w-full max-w-6xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{form.name} — Records</h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">{data.total} total row{data.total !== 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  toast.loading('Preparing CSV…', { id: 'csv' });
                  const { data: res } = await api.get(
                    `/forms/${form.formKey}/records?page=1&limit=10000`
                  );
                  const cols = getDisplayColumns(form.formKey, res.records?.[0] ?? null);
                  downloadCSV(`${form.formKey}.csv`, res.records, cols, form.formKey);
                  toast.success('Downloaded!', { id: 'csv' });
                } catch {
                  toast.error('Download failed.', { id: 'csv' });
                }
              }}
              className="btn-secondary text-xs py-1.5"
            >
              <MdDownload className="h-3.5 w-3.5" />
              Download CSV
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : !data?.records?.length ? (
            <div className="text-center py-20 text-gray-400 text-sm">No records found.</div>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  {headingRuns(columns).map((run) => (
                    <th
                      key={run.start}
                      colSpan={run.colSpan}
                      className="px-3 py-2 text-center font-semibold text-gray-600 tracking-wide border-b border-gray-200"
                    >
                      {run.heading}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200">
                  {columns.map((col) => (
                    <th
                      key={col.dbKey}
                      className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap border-b border-gray-200"
                    >
                      {col.subheading || '\u2014'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.records.map((row, i) => (
                  <tr key={`${page}-${i}`} className="hover:bg-gray-50">
                    {columns.map((col) => (
                      <td
                        key={col.dbKey}
                        className="px-3 py-2 text-gray-700 whitespace-nowrap"
                      >
                        {row[col.dbKey] === null || row[col.dbKey] === undefined ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          formatRecordCellForDisplay(col.dbKey, row[col.dbKey], form.formKey)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page === 1 || loading}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              >
                <MdChevronLeft className="h-4 w-4" />
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button
                    key={p}
                    onClick={() => fetchPage(p)}
                    disabled={loading}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page === totalPages || loading}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              >
                <MdChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main FormTable ───────────────────────────────────────────
const FormTable = ({
  forms,
  nameColumnHeader = 'Form Name',
  emptyMessage = 'No forms are assigned to you for this app.',
}) => {
  const navigate            = useNavigate();
  const [viewing, setViewing] = useState(null); // form object being viewed

  if (!forms || forms.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="th">#</th>
              <th className="th">{nameColumnHeader}</th>
              <th className="th">Description</th>
              <th className="th text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {forms.map((form, idx) => (
              <tr key={form._id} className="hover:bg-gray-50 transition-colors">
                <td className="td text-gray-400">{idx + 1}</td>
                <td className="td font-medium text-gray-900">{form.name}</td>
                <td className="td text-gray-500">{form.description || '—'}</td>
                <td className="td">
                  <div className="flex items-center justify-center gap-2">

                    {/* Open form or hub module (equipment / EHS) */}
                    <button
                      onClick={() => {
                        if (isBiDashboardFormKey(form.formKey)) {
                          const path = biDashboardPath(form.formKey);
                          if (path) navigate(path);
                          return;
                        }
                        if (isHubFormKey(form.formKey)) {
                          navigate(hubFormPath(form.formKey));
                          return;
                        }
                        navigate(`/forms/${form.formKey}`);
                      }}
                      className="btn-primary py-1.5 text-xs"
                    >
                      <MdOpenInNew className="h-3.5 w-3.5" />
                      {isHubFormKey(form.formKey) || isBiDashboardFormKey(form.formKey)
                        ? 'Open'
                        : 'Open Form'}
                    </button>

                    {!isHubFormKey(form.formKey) && !isBiDashboardFormKey(form.formKey) && (
                      <>
                        <button
                          onClick={() => setViewing(form)}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          <MdTableChart className="h-3.5 w-3.5" />
                          View Data
                        </button>

                        <button
                          onClick={async () => {
                            const tid = toast.loading('Preparing CSV…');
                            try {
                              const { data } = await api.get(
                                `/forms/${form.formKey}/records?page=1&limit=10000`
                              );
                              const cols = getDisplayColumns(form.formKey, data.records?.[0] ?? null);
                              downloadCSV(`${form.formKey}.csv`, data.records, cols, form.formKey);
                              toast.success('Downloaded!', { id: tid });
                            } catch {
                              toast.error('Download failed.', { id: tid });
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5
                                     bg-green-600 text-white text-xs font-medium rounded-lg
                                     hover:bg-green-700 transition-colors"
                        >
                          <MdDownload className="h-3.5 w-3.5" />
                          CSV
                        </button>
                      </>
                    )}

                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Data Modal */}
      {viewing && (
        <ViewDataModal form={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
};

export default FormTable;
