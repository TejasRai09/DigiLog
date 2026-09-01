import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MdClose, MdDelete, MdEdit, MdMoreVert, MdSave, MdVisibility,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';
import {
  getDisplayColumns,
  headerLabel,
  formatRecordCellForDisplay,
} from '../config/formColumnSchemas';

const NON_EDITABLE_COLS = new Set([
  'timestamp',
  'timestamp_col',
  'FS%',
  'total_mol_in_store_qtls',
]);

export function recordKeyFromRow(row, tsCol = 'timestamp') {
  const v = row?.[tsCol];
  if (v == null) return null;
  const s = typeof v === 'string' ? v : String(v);
  return encodeURIComponent(s);
}

function formatDateInputValue(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

function cellToEditValue(dbKey, value) {
  if (value == null) return '';
  if (dbKey === 'Date') return formatDateInputValue(value);
  if (typeof value === 'string' && value.startsWith('data:image/')) return value;
  return String(value);
}

function buildSections(columns, row, formKey, { readOnly = true } = {}) {
  const sections = [];
  let current = null;

  for (const col of columns) {
    if (NON_EDITABLE_COLS.has(col.dbKey)) continue;
    if (!current || current.heading !== col.heading) {
      current = { heading: col.heading, items: [] };
      sections.push(current);
    }
    const raw = row[col.dbKey];
    current.items.push({
      dbKey: col.dbKey,
      label: col.subheading || col.dbKey,
      value: readOnly
        ? formatRecordCellForDisplay(col.dbKey, raw, formKey)
        : cellToEditValue(col.dbKey, raw),
      raw,
    });
  }
  return sections;
}

function RecordModalShell({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative my-auto flex w-full max-w-3xl max-h-[min(calc(100dvh-1.5rem),90vh)] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <MdClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-gray-100 px-4 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function isImageDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isPdfDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:application/pdf');
}

function openDataUrl(value, fileName = 'download') {
  if (!value) return;
  const a = document.createElement('a');
  a.href = value;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.download = fileName;
  a.click();
}

export function RecordViewModal({ form, row, tsCol, onClose }) {
  const columns = getDisplayColumns(form.formKey, row);
  const sections = useMemo(
    () => buildSections(columns, row, form.formKey, { readOnly: true }),
    [columns, row, form.formKey],
  );
  const [preview, setPreview] = useState(null);

  return (
    <RecordModalShell
      title={`${form.name} — Record Details`}
      subtitle="Read-only view"
      onClose={onClose}
    >
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.heading}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.heading}</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              {section.items.map((item) => {
                const fileName =
                  item.dbKey === 'hod_signoff_file'
                    ? (row.hod_signoff_file_name || 'hod_signoff')
                    : item.label;
                const canPreview = isImageDataUrl(item.raw) || isPdfDataUrl(item.raw);
                const canOpen = isDataUrl(item.raw);

                return (
                  <div key={item.dbKey} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <dt className="text-[11px] font-medium text-gray-500">{item.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-gray-900">
                      {item.value === '' ? (
                        <span className="text-gray-300">—</span>
                      ) : canOpen ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.value}</span>
                          {canPreview ? (
                            <button
                              type="button"
                              onClick={() => setPreview({ src: item.raw, title: fileName })}
                              className="text-xs font-semibold text-amber-800 hover:underline"
                            >
                              View
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openDataUrl(item.raw, fileName)}
                            className="text-xs font-semibold text-amber-800 hover:underline"
                          >
                            {canPreview ? 'Download' : 'Open / Download'}
                          </button>
                        </div>
                      ) : (
                        item.value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <div className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="truncate text-sm font-semibold">{preview.title}</h3>
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Close">
                <MdClose className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950 p-3">
              {isImageDataUrl(preview.src) ? (
                <img src={preview.src} alt={preview.title} className="max-h-[75dvh] max-w-full object-contain" />
              ) : (
                <iframe title={preview.title} src={preview.src} className="h-[75dvh] w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </RecordModalShell>
  );
}

export function RecordEditModal({ form, row, tsCol, onClose, onSaved }) {
  const columns = getDisplayColumns(form.formKey, row);
  const editableCols = useMemo(
    () => columns.filter((c) => !NON_EDITABLE_COLS.has(c.dbKey)),
    [columns],
  );

  const [draft, setDraft] = useState(() => {
    const init = {};
    for (const col of editableCols) {
      init[col.dbKey] = cellToEditValue(col.dbKey, row[col.dbKey]);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const recordKey = recordKeyFromRow(row, tsCol);

  const handleSave = async () => {
    if (!recordKey) {
      toast.error('Cannot identify this record.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/forms/${form.formKey}/records/${recordKey}`, draft);
      toast.success('Record updated.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecordModalShell
      title={`${form.name} — Edit Record`}
      subtitle="Admin edit"
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button type="button" onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {editableCols.map((col) => {
          const label = headerLabel(col);
          const value = draft[col.dbKey] ?? '';
          const isFileField = isDataUrl(value) || col.dbKey === 'hod_signoff_file'
            || col.dbKey.endsWith('_photo') || col.dbKey === 'stoppage_photos';
          const isLong = col.dbKey === 'remarks' || col.dbKey === 'remark'
            || col.dbKey === 'topic_discussed' || String(value).length > 80;

          if (isFileField) {
            const display = isDataUrl(value)
              ? (isImageDataUrl(value) ? 'Photo attached' : 'File attached')
              : (value ? String(value) : '—');
            return (
              <div key={col.dbKey} className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {display}
                  <span className="ml-2 text-xs text-gray-400">(edit on form / re-upload not supported here)</span>
                </p>
              </div>
            );
          }

          if (col.dbKey === 'Date') {
            return (
              <label key={col.dbKey} className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                <input
                  type="date"
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [col.dbKey]: e.target.value }))}
                  className="input w-full"
                />
              </label>
            );
          }

          if (col.dbKey === 'Shift') {
            return (
              <label key={col.dbKey} className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                <select
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [col.dbKey]: e.target.value }))}
                  className="input w-full"
                >
                  <option value="">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
            );
          }

          return (
            <label key={col.dbKey} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
              {isLong ? (
                <textarea
                  value={value}
                  rows={3}
                  onChange={(e) => setDraft((d) => ({ ...d, [col.dbKey]: e.target.value }))}
                  className="input w-full resize-y"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setDraft((d) => ({ ...d, [col.dbKey]: e.target.value }))}
                  className="input w-full"
                />
              )}
            </label>
          );
        })}
      </div>
    </RecordModalShell>
  );
}

export function DeleteRecordConfirmModal({ form, row, tsCol, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const recordKey = recordKeyFromRow(row, tsCol);
  const dateLabel = formatRecordCellForDisplay('Date', row.Date, form.formKey) || 'this record';

  const handleDelete = async () => {
    if (!recordKey) {
      toast.error('Cannot identify this record.');
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/forms/${form.formKey}/records/${recordKey}`);
      toast.success('Record deleted.');
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RecordModalShell title="Delete record?" onClose={onClose}>
      <p className="text-sm text-gray-600">
        Permanently delete the record for <strong>{dateLabel}</strong> from{' '}
        <strong>{form.name}</strong>? This cannot be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-secondary" disabled={deleting}>Cancel</button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? <Spinner size="sm" /> : <MdDelete className="h-4 w-4" />}
          Delete
        </button>
      </div>
    </RecordModalShell>
  );
}

export function RecordRowActionMenu({ rowMenu, onClose, onView, onEdit, onDelete }) {
  if (!rowMenu) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[105]" aria-hidden onClick={onClose} />
      <div
        className="fixed z-[106] min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        style={{ top: rowMenu.top, right: rowMenu.right, left: rowMenu.left }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onView(rowMenu.row); }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
        >
          <MdVisibility className="h-4 w-4 text-blue-600" />
          View
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onEdit(rowMenu.row); }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
        >
          <MdEdit className="h-4 w-4 text-amber-600" />
          Edit
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => { onClose(); onDelete(rowMenu.row); }}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
        >
          <MdDelete className="h-4 w-4" />
          Delete
        </button>
      </div>
    </>,
    document.body,
  );
}

export function RecordActionsButton({ onOpenMenu }) {
  return (
    <button
      type="button"
      onClick={onOpenMenu}
      className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
      title="Actions"
      aria-label="Record actions"
    >
      <MdMoreVert className="h-5 w-5" />
    </button>
  );
}
