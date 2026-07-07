import { useEffect, useRef, useState } from 'react';
import { MdClose, MdPhotoCamera } from 'react-icons/md';
import toast from 'react-hot-toast';
import { resizeImage } from '../utils/resizeImage';

/** Single image upload field styled for GSMA form pages. */
export default function FormPhotoField({ label, value, onChange, required = false }) {
  const inputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG or JPG).');
      return;
    }
    try {
      onChange(await resizeImage(file));
      setPreviewOpen(false);
    } catch {
      toast.error('Could not read the selected image.');
    }
  };

  const handleRemove = (ev) => {
    ev.stopPropagation();
    onChange('');
    setPreviewOpen(false);
  };

  return (
    <div className="w-full min-w-0">
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />

      {value ? (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setPreviewOpen(true)}
            onKeyDown={(ev) => ev.key === 'Enter' && setPreviewOpen(true)}
            className="group relative flex flex-col items-center justify-center min-h-[160px] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden cursor-zoom-in"
            title="Click to view full size"
          >
            <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
              <span className="text-white text-xs font-semibold bg-gray-900/80 px-3 py-1.5 rounded-md">
                View photo
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-gray-900/90 hover:bg-red-600 text-white rounded-md transition-colors z-10"
              title="Remove photo"
            >
              <MdClose className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openPicker}
            className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Change photo
          </button>
        </>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(ev) => ev.key === 'Enter' && openPicker()}
          className="group relative flex flex-col items-center justify-center min-h-[160px] rounded-lg border-2 border-dashed border-gray-200 hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/20 cursor-pointer transition-colors overflow-hidden"
        >
          <div className="text-center p-4">
            <div className="p-3 bg-white rounded-full shadow-sm text-gray-400 group-hover:text-emerald-600 inline-block border border-gray-100">
              <MdPhotoCamera className="w-5 h-5" />
            </div>
            <span className="block mt-2 text-xs font-medium text-gray-500">Click to upload</span>
            <p className="text-[10px] text-gray-400 mt-0.5">PNG or JPG</p>
          </div>
        </div>
      )}

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
          <div className="relative flex max-h-[min(90dvh,900px)] max-w-[min(92vw,960px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
              <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{label}</h3>
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
              <img
                src={value}
                alt={label}
                className="max-h-[min(75dvh,820px)] max-w-full object-contain"
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
              <button type="button" onClick={() => setPreviewOpen(false)} className="btn-secondary">
                Close
              </button>
              <button type="button" onClick={openPicker} className="btn-primary">
                Change photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
