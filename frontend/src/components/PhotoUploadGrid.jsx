import { MdAdd, MdClose } from 'react-icons/md';
import { resizeImage } from '../utils/resizeImage';

/**
 * Grid of thumbnail uploads (equipment maintenance history style).
 * @param {number} maxPhotos - Maximum number of images (default 3).
 */
export default function PhotoUploadGrid({ label, photos, onChange, inputRef, maxPhotos = 3 }) {
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photos.length >= maxPhotos) return;
    if (!file.type.startsWith('image/')) return;
    const data = await resizeImage(file);
    onChange([...photos, data]);
  };

  return (
    <div className="space-y-2">
      {label ? (
        <span className="block text-xs font-semibold text-slate-500">{label}</span>
      ) : null}
      <div className="grid grid-cols-3 gap-2 max-w-md">
        {photos.map((img, idx) => (
          <div
            key={idx}
            className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          >
            <img src={img} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, i) => i !== idx))}
              className="absolute right-1 top-1 rounded-full bg-slate-950/80 p-1 text-white hover:bg-slate-950"
              aria-label="Remove photo"
            >
              <MdClose className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {photos.length < maxPhotos ? (
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
