import { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner';

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function mimeFromDataUrl(dataUrl = '') {
  return String(dataUrl).match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || '';
}

export function isWordFile(src, name = '') {
  const mime = mimeFromDataUrl(src);
  const n = String(name || '').toLowerCase();
  return (
    n.endsWith('.docx') ||
    n.endsWith('.doc') ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  );
}

export function isDocxFile(src, name = '') {
  const mime = mimeFromDataUrl(src);
  const n = String(name || '').toLowerCase();
  return n.endsWith('.docx') || mime.includes('wordprocessingml');
}

/** Renders a .docx data URL inside the preview modal. */
export default function WordDocPreview({ src, title }) {
  const hostRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !src) return undefined;

    host.innerHTML = '';
    setLoading(true);
    setError('');

    (async () => {
      try {
        if (!isDocxFile(src, title)) {
          throw new Error('legacy-doc');
        }
        const { renderAsync } = await import('docx-preview');
        if (cancelled) return;
        await renderAsync(dataUrlToArrayBuffer(src), host, undefined, {
          inWrapper: true,
          ignoreWidth: true,
          breakPages: true,
        });
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError(
            isDocxFile(src, title)
              ? 'Could not preview this Word file.'
              : 'This older .doc format cannot be shown in the browser. Download the file to open it.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (host) host.innerHTML = '';
    };
  }, [src, title]);

  return (
    <div className="relative h-[75dvh] w-full overflow-auto bg-slate-100">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
          <Spinner size="lg" />
        </div>
      ) : null}
      {error ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-600">{error}</p>
          <a
            href={src}
            download={title || 'document.docx'}
            className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
          >
            Download file
          </a>
        </div>
      ) : null}
      <div ref={hostRef} className="docx-preview-host min-h-full bg-white p-4" />
    </div>
  );
}
