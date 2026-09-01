import { useEffect, useRef, useState } from 'react';
import { MdClose, MdDeleteOutline } from 'react-icons/md';
import toast from 'react-hot-toast';

const MAX_BYTES = 6 * 1024 * 1024; // stay under Express 10mb JSON limit after base64

const ACCEPT =
  '.jpg,.jpeg,.pdf,.doc,.docx,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'pdf', 'doc', 'docx']);

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dataUrlByteSize(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
}

function fileExt(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isAllowedFile(file) {
  const ext = fileExt(file.name);
  if (ALLOWED_EXT.has(ext)) return true;
  const t = String(file.type || '').toLowerCase();
  return (
    t === 'image/jpeg' ||
    t === 'image/jpg' ||
    t === 'application/pdf' ||
    t === 'application/msword' ||
    t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function resolveMime(file) {
  const t = String(file.type || '').toLowerCase();
  if (t && t !== 'application/octet-stream') return t;
  return MIME_BY_EXT[fileExt(file.name)] || 'application/octet-stream';
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function mimeFromDataUrl(dataUrl = '') {
  const m = String(dataUrl).match(/^data:([^;,]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function isImageDataUrl(dataUrl) {
  return mimeFromDataUrl(dataUrl).startsWith('image/');
}

function isPdfDataUrl(dataUrl) {
  return mimeFromDataUrl(dataUrl) === 'application/pdf';
}

/**
 * Form file upload row: JPG/JPEG, PDF, Word — with Upload / View / Get.
 * Value is a data-URL string; optional fileName is kept separately for display.
 */
export default function FormFileUploadRow({
  label,
  hint,
  value,
  fileName: fileNameProp = '',
  onChange,
  required = false,
  optional = false,
}) {
  const inputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileName, setFileName] = useState(fileNameProp || '');
  const [fileSize, setFileSize] = useState(0);

  useEffect(() => {
    if (!value) {
      setFileName('');
      setFileSize(0);
      return;
    }
    if (fileNameProp) setFileName(fileNameProp);
    setFileSize(dataUrlByteSize(value));
  }, [value, fileNameProp]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewOpen]);

  const openPicker = () => inputRef.current?.click();

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAllowedFile(file)) {
      toast.error('Allowed types: JPG, JPEG, PDF, Word (.doc / .docx).');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File is too large. Maximum size is 6 MB.');
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      // Ensure MIME is correct even when the browser left type empty
      const mime = resolveMime(file);
      const normalised =
        dataUrl.startsWith('data:') && !dataUrl.startsWith(`data:${mime}`)
          ? dataUrl.replace(/^data:[^;,]*/, `data:${mime}`)
          : dataUrl;
      setFileName(file.name);
      setFileSize(file.size);
      onChange({ dataUrl: normalised, fileName: file.name });
      setPreviewOpen(false);
    } catch {
      toast.error('Could not read the selected file.');
    }
  };

  const handleRemove = () => {
    onChange({ dataUrl: '', fileName: '' });
    setFileName('');
    setFileSize(0);
    setPreviewOpen(false);
  };

  const displayName =
    fileName ||
    (value
      ? `${label.replace(/\s+/g, '_').toLowerCase()}${isPdfDataUrl(value) ? '.pdf' : isImageDataUrl(value) ? '.jpg' : ''}`
      : '');

  const handleGet = () => {
    if (!value) return;
    const a = document.createElement('a');
    a.href = value;
    a.download = displayName || 'download';
    a.click();
  };

  const handleView = () => {
    if (!value) return;
    if (isImageDataUrl(value) || isPdfDataUrl(value)) {
      setPreviewOpen(true);
      return;
    }
    // Word and other types: open / download in a new tab
    const a = document.createElement('a');
    a.href = value;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = displayName || 'document';
    a.click();
  };

  const displaySize = formatBytes(fileSize || dataUrlByteSize(value));

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-gray-100 py-5 last:border-b-0 lg:flex-row lg:items-center">
        <div className="shrink-0 lg:w-52 xl:w-56">
          <p className="text-sm font-semibold text-gray-900">
            {label}
            {required ? <span className="ml-0.5 text-red-500">*</span> : null}
            {optional ? (
              <span className="ml-1.5 text-xs font-normal text-gray-400">(Optional)</span>
            ) : null}
          </p>
          {hint ? <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p> : null}
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handlePick}
          />

          {value ? (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{displaySize}</p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Remove file"
                aria-label="Remove file"
              >
                <MdDeleteOutline className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3">
              <p className="text-sm text-gray-400">No file selected</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <button type="button" onClick={openPicker} className="btn-secondary min-h-[40px] px-4 py-2">
            Upload
          </button>
          <button
            type="button"
            onClick={handleView}
            disabled={!value}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            View
          </button>
          <button
            type="button"
            onClick={handleGet}
            disabled={!value}
            className="btn-secondary min-h-[40px] px-4 py-2"
          >
            Get
          </button>
        </div>
      </div>

      {previewOpen && value ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} preview`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px]"
            aria-label="Close preview"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative flex max-h-[min(90dvh,900px)] max-w-[min(92vw,960px)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
              <h3 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                {displayName || label}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-950/95 p-3 sm:p-4">
              {isImageDataUrl(value) ? (
                <img
                  src={value}
                  alt={displayName || label}
                  className="max-h-[min(75dvh,820px)] max-w-full object-contain"
                />
              ) : isPdfDataUrl(value) ? (
                <iframe
                  title={displayName || label}
                  src={value}
                  className="h-[min(75dvh,820px)] w-full rounded-md bg-white"
                />
              ) : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
              <button type="button" onClick={() => setPreviewOpen(false)} className="btn-secondary">
                Close
              </button>
              <button type="button" onClick={openPicker} className="btn-primary">
                Change file
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
