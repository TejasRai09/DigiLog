import { useRef } from 'react';
import { MdAdd, MdClose } from 'react-icons/md';
import { FaFilePdf, FaFileWord, FaFile } from 'react-icons/fa6';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { resizeImage } from '../../utils/resizeImage';

export const MAX_NOTE_PHOTOS = 3;
export const MAX_NOTE_DOCUMENTS = 3;
export const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;
const NOTE_DOCUMENT_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isNoteDocument(file) {
  const name = String(file?.name || '').toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx');
}

function documentKind(doc) {
  const name = String(doc?.originalName || doc?.file?.name || doc?.displayName || '').toLowerCase();
  const mime = String(doc?.mimeType || doc?.file?.type || '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return 'word';
  return 'generic';
}

function DocumentFileIcon({ doc, className = 'w-9 h-9' }) {
  if (documentKind(doc) === 'pdf') return <FaFilePdf className={`${className} text-red-500`} aria-hidden />;
  if (documentKind(doc) === 'word') return <FaFileWord className={`${className} text-blue-600`} aria-hidden />;
  return <FaFile className={`${className} text-slate-400`} aria-hidden />;
}

export function NotePhotoGrid({ photos, onChange, disabled = false }) {
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photos.length >= MAX_NOTE_PHOTOS || disabled) return;
    try {
      const data = await resizeImage(file);
      onChange([...photos, data]);
    } catch {
      toast.error('Could not read that image.');
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-slate-500">Photos</span>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((img, idx) => (
          <div
            key={idx}
            className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          >
            <img src={img} alt="" className="h-full w-full object-cover" />
            {disabled ? null : (
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                className="absolute right-1 top-1 rounded-full bg-slate-950/80 p-1 text-white hover:bg-slate-950"
              >
                <MdClose className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && photos.length < MAX_NOTE_PHOTOS ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-all hover:border-blue-400 hover:bg-slate-50/50 hover:text-blue-500"
          >
            <MdAdd className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Add</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

export function NoteDocumentGrid({ documents, onChange, disabled = false }) {
  const inputRef = useRef(null);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || documents.length >= MAX_NOTE_DOCUMENTS || disabled) return;
    if (!isNoteDocument(file)) {
      toast.error('Only PDF and Word documents can be added.');
      return;
    }
    if (file.size > MAX_NOTE_DOCUMENT_BYTES) {
      toast.error(`"${file.name}" is too large (max 10 MB).`);
      return;
    }
    onChange([
      ...documents,
      {
        storageKey: null,
        displayName: file.name,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        pending: true,
        file,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {documents.map((doc, index) => (
          <div key={doc.storageKey || `pending-${index}`} className="min-w-0 space-y-1">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
              <DocumentFileIcon doc={doc} />
              {disabled ? null : (
                <button
                  type="button"
                  onClick={() => onChange(documents.filter((_, idx) => idx !== index))}
                  className="absolute right-1 top-1 rounded-full bg-slate-950/80 p-1 text-white hover:bg-slate-950"
                >
                  <MdClose className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={doc.displayName || ''}
              disabled={disabled}
              onChange={(e) => onChange(documents.map((item, idx) => (
                idx === index ? { ...item, displayName: e.target.value } : item
              )))}
              className="w-full truncate rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center text-[10px] outline-none disabled:bg-slate-50"
              placeholder="Name"
              title={doc.displayName || ''}
            />
          </div>
        ))}
        {!disabled && documents.length < MAX_NOTE_DOCUMENTS ? (
          <div className="min-w-0 space-y-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-all hover:border-blue-400 hover:bg-slate-50/50 hover:text-blue-500"
            >
              <MdAdd className="mb-1 h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Add</span>
            </button>
            <span className="block text-center text-[10px] font-semibold text-slate-400">Document</span>
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={NOTE_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

export async function uploadNoteDocument(noteId, file, displayName) {
  const fd = new FormData();
  fd.append('document', file);
  fd.append('displayName', displayName || file.name);
  const { data } = await api.post(`/maintenance-notes/${noteId}/documents`, fd);
  return data.document;
}

export async function downloadNoteDocument(noteId, doc) {
  const fileName = String(doc?.storageKey || '').split('/').pop();
  if (!fileName) throw new Error('Invalid document.');
  const response = await api.get(
    `/maintenance-notes/${noteId}/documents/${encodeURIComponent(fileName)}`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.displayName || fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
