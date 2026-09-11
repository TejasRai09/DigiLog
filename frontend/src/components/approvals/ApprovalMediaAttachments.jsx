import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

function formatBytes(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(doc) {
  const mime = String(doc?.mimeType || '').toLowerCase();
  const name = String(doc?.displayName || doc?.name || '').toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

function isImageDoc(doc) {
  const mime = String(doc?.mimeType || '').toLowerCase();
  const name = String(doc?.displayName || doc?.name || '').toLowerCase();
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

/** Strip leading /api so axios baseURL (/api) is not doubled. */
function toApiPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/')) return raw.slice(4);
  if (raw.startsWith('api/')) return `/${raw.slice(4)}`;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

async function fetchDocumentBlob(doc, disposition = 'inline') {
  const path = toApiPath(doc.url);
  if (!path) throw new Error('Document link missing.');
  const sep = path.includes('?') ? '&' : '?';
  const { data, headers } = await api.get(
    `${path}${disposition === 'attachment' ? `${sep}disposition=attachment` : ''}`,
    { responseType: 'blob' },
  );
  const mime = headers['content-type'] || doc.mimeType || 'application/octet-stream';
  return data instanceof Blob ? data : new Blob([data], { type: mime });
}

function MediaLightbox({ open, kind, src, caption, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={caption || 'Media viewer'}
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold text-slate-100">
            {caption || 'Preview'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-slate-600"
          >
            Close
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-3">
          {kind === 'iframe' ? (
            <iframe
              title={caption || 'Document'}
              src={src}
              className="h-[min(80vh,720px)] w-full rounded-lg bg-white"
            />
          ) : (
            <img
              src={src}
              alt={caption || ''}
              className="max-h-[calc(100vh-7rem)] max-w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({ label, sources, onOpen }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label} · click to enlarge
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sources.map((src, i) => (
          <button
            key={`${label}-${i}`}
            type="button"
            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            onClick={() => onOpen(src, `${label} #${i + 1}`)}
            title="Open full size"
          >
            <img src={src} alt="" className="h-28 w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DocumentList({ documents, onView, busyKey }) {
  if (!documents?.length) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        Documents · click to view
      </p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {documents.map((doc) => {
          const viewKey = `${doc.source}:${doc.name}:inline`;
          const dlKey = `${doc.source}:${doc.name}:attachment`;
          return (
            <li
              key={`${doc.source}-${doc.name}`}
              className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {doc.displayName || doc.name || 'Document'}
                </p>
                <p className="text-xs text-slate-500">
                  {doc.mimeType || 'file'}
                  {doc.size ? ` · ${formatBytes(doc.size)}` : ''}
                  {doc.source === 'staged' ? ' · new upload' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyKey === viewKey}
                  onClick={() => onView(doc, 'inline')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyKey === viewKey ? 'Opening…' : 'View'}
                </button>
                <button
                  type="button"
                  disabled={busyKey === dlKey}
                  onClick={() => onView(doc, 'attachment')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyKey === dlKey ? 'Downloading…' : 'Download'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Photos + documents for logged-in approval Review modal (lightbox like no-login inbox). */
export default function ApprovalMediaAttachments({ item }) {
  const before = item?.photosBefore || [];
  const after = item?.photosAfter || [];
  const documents = item?.documents || [];
  const [lightbox, setLightbox] = useState({ open: false, kind: 'image', src: '', caption: '' });
  const [busyKey, setBusyKey] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);

  const closeLightbox = () => {
    setLightbox({ open: false, kind: 'image', src: '', caption: '' });
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
  };

  const openPhoto = (src, caption) => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    setLightbox({ open: true, kind: 'image', src, caption });
  };

  const handleDocument = async (doc, disposition) => {
    const key = `${doc.source}:${doc.name}:${disposition}`;
    setBusyKey(key);
    try {
      const blob = await fetchDocumentBlob(doc, disposition);
      if (disposition === 'attachment') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.displayName || doc.name || 'document';
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      if (isPdf(doc)) {
        setLightbox({
          open: true,
          kind: 'iframe',
          src: url,
          caption: doc.displayName || doc.name || 'Document',
        });
      } else if (isImageDoc(doc)) {
        setLightbox({
          open: true,
          kind: 'image',
          src: url,
          caption: doc.displayName || doc.name || 'Document',
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setObjectUrl(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Could not open document.');
    } finally {
      setBusyKey(null);
    }
  };

  if (!before.length && !after.length && !documents.length) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <PhotoGrid label="Before photos" sources={before} onOpen={openPhoto} />
      <PhotoGrid label="After photos" sources={after} onOpen={openPhoto} />
      <DocumentList documents={documents} onView={handleDocument} busyKey={busyKey} />
      <MediaLightbox
        open={lightbox.open}
        kind={lightbox.kind}
        src={lightbox.src}
        caption={lightbox.caption}
        onClose={closeLightbox}
      />
    </div>
  );
}
