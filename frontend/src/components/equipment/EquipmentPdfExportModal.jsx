import { useEffect, useState } from 'react';
import { MdClose, MdPictureAsPdf } from 'react-icons/md';
import Spinner from '../Spinner';

const DEFAULT_SECTIONS = [
  { key: 'specs', label: 'Equipment Specification' },
  { key: 'schedule', label: 'OEM Maintenance Schedule' },
  { key: 'history', label: 'Equipment Maintenance History' },
];

/**
 * Confirmation modal for the "Download PDF" button on the equipment detail
 * page: lets the user pick which of the three sections to include (all
 * checked by default) before rendering the PDF.
 */
export default function EquipmentPdfExportModal({
  open,
  onClose,
  onConfirm,
  generating = false,
  sections = DEFAULT_SECTIONS,
}) {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(sections.map((s) => [s.key, true])));

  useEffect(() => {
    if (open) setChecked(Object.fromEntries(sections.map((s) => [s.key, true])));
  }, [open, sections]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !generating) onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, generating, onClose]);

  if (!open) return null;

  const anyChecked = sections.some((s) => checked[s.key]);

  const toggle = (key) => setChecked((p) => ({ ...p, [key]: !p[key] }));

  const handleConfirm = () => {
    const selectedKeys = sections.filter((s) => checked[s.key]).map((s) => s.key);
    if (!selectedKeys.length) return;
    onConfirm(selectedKeys);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => !generating && onClose()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <MdPictureAsPdf className="h-5 w-5 text-red-500" />
            Download as PDF
          </h3>
          <button
            type="button"
            onClick={() => !generating && onClose()}
            disabled={generating}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-gray-500">
            Choose which sections to include in the PDF.
          </p>
          <div className="space-y-2.5">
            {sections.map((s) => (
              <label
                key={s.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  checked={Boolean(checked[s.key])}
                  onChange={() => toggle(s.key)}
                  disabled={generating}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-800">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="btn-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={generating || !anyChecked}
            className="btn-primary flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Spinner size="sm" /> : <MdPictureAsPdf className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
