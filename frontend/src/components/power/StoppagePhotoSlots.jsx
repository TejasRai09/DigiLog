import { useEffect, useRef, useState } from 'react';
import { MdAdd, MdClose, MdCloudUpload } from 'react-icons/md';
import toast from 'react-hot-toast';
import { resizeImage } from '../../utils/resizeImage';

const SLOT_SIZE = 'h-24 w-24';

export default function StoppagePhotoSlots({ photos, onChange, maxPhotos = 2 }) {
  const inputRef = useRef(null);
  const pickIndexRef = useRef(0);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const openPicker = (index) => {
    pickIndexRef.current = index;
    inputRef.current?.click();
  };

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a JPG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }
    try {
      const data = await resizeImage(file);
      const next = [...photos];
      const idx = pickIndexRef.current;
      if (idx < next.length) next[idx] = data;
      else next.push(data);
      onChange(next.slice(0, maxPhotos));
    } catch {
      toast.error('Could not read the selected image.');
    }
  };

  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] || null);

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePick} />
      <div className="flex flex-wrap gap-3">
        {slots.map((img, idx) => (
          img ? (
            <div key={idx} className={`relative shrink-0 ${SLOT_SIZE}`}>
              <button
                type="button"
                onClick={() => setPreview({ src: img, index: idx + 1 })}
                className="h-full w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                aria-label={`View stoppage photo ${idx + 1}`}
              >
                <img src={img} alt="" className="h-full w-full cursor-zoom-in object-cover" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(photos.filter((_, i) => i !== idx));
                  if (preview?.src === img) setPreview(null);
                }}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900/85 p-1 text-white shadow hover:bg-red-600"
                aria-label="Remove photo"
              >
                <MdClose className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              key={idx}
              type="button"
              onClick={() => openPicker(idx)}
              className={`${SLOT_SIZE} flex shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed px-1 text-center transition-colors ${
                idx === 0
                  ? 'border-blue-300 bg-blue-50/40 text-blue-600 hover:border-blue-400 hover:bg-blue-50'
                  : 'border-gray-200 bg-gray-50/50 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {idx === 0 ? (
                <>
                  <MdCloudUpload className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-semibold leading-tight">Upload</span>
                  <span className="mt-0.5 text-[9px] leading-tight text-gray-500">Max 5MB</span>
                </>
              ) : (
                <>
                  <MdAdd className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-semibold leading-tight">Add</span>
                  <span className="mt-0.5 text-[9px] leading-tight text-gray-500">Max {maxPhotos}</span>
                </>
              )}
            </button>
          )
        ))}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Stoppage photo ${preview.index}`}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close preview"
          >
            <MdClose className="h-5 w-5" />
          </button>
          <img
            src={preview.src}
            alt=""
            className="max-h-[85vh] max-w-full rounded-xl border border-white/10 object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
