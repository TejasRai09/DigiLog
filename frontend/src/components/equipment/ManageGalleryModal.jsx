import { useEffect, useRef, useState } from 'react';
import { MdClose, MdDelete, MdPhotoLibrary } from 'react-icons/md';
import { resizeImage } from '../../utils/resizeImage';
import {
  MIN_GALLERY_CAPTION_LENGTH,
  SUBGROUP_GALLERY_SIZE,
  validateSubGroupGalleryImages,
} from '../../utils/equipmentSpecModel';

export { MIN_GALLERY_CAPTION_LENGTH };

function normalizeDraftImages(images) {
  const slots = Array.from({ length: SUBGROUP_GALLERY_SIZE }, (_, i) => ({
    src: images?.[i]?.src || null,
    caption: images?.[i]?.caption || '',
  }));
  return slots;
}

export default function ManageGalleryModal({
  open,
  targetLabel,
  initialImages = [],
  onClose,
  onApply,
  saving = false,
}) {
  const fileRef = useRef(null);
  const [draftImages, setDraftImages] = useState(() => normalizeDraftImages(initialImages));
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingPreview, setPendingPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraftImages(normalizeDraftImages(initialImages));
    setPendingFileName('');
    setPendingPreview(null);
    setCaption('');
    setFormError('');
    if (fileRef.current) fileRef.current.value = '';
  }, [open, initialImages]);

  if (!open) return null;

  const filledCount = draftImages.filter((img) => img.src).length;
  const captionLen = caption.trim().length;
  const captionValid = captionLen >= MIN_GALLERY_CAPTION_LENGTH;
  const canAppend = Boolean(pendingPreview) && captionValid && filledCount < SUBGROUP_GALLERY_SIZE;

  const resetPending = () => {
    setPendingFileName('');
    setPendingPreview(null);
    setCaption('');
    setFormError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleChooseFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await resizeImage(file);
    setPendingFileName(file.name);
    setPendingPreview(src);
    setFormError('');
  };

  const handleAppend = () => {
    if (!pendingPreview) {
      setFormError('Please choose an image file.');
      return;
    }
    if (!captionValid) {
      setFormError(`Image description must be at least ${MIN_GALLERY_CAPTION_LENGTH} characters.`);
      return;
    }
    if (filledCount >= SUBGROUP_GALLERY_SIZE) {
      setFormError(`Maximum ${SUBGROUP_GALLERY_SIZE} images allowed.`);
      return;
    }

    const emptyIndex = draftImages.findIndex((img) => !img.src);
    if (emptyIndex === -1) {
      setFormError(`Maximum ${SUBGROUP_GALLERY_SIZE} images allowed.`);
      return;
    }

    setDraftImages((prev) =>
      prev.map((img, i) =>
        i === emptyIndex ? { src: pendingPreview, caption: caption.trim() } : img
      )
    );
    resetPending();
  };

  const handleRemove = (index) => {
    setDraftImages((prev) =>
      prev.map((img, i) => (i === index ? { src: null, caption: '' } : img))
    );
  };

  const handleApply = () => {
    const galleryError = validateSubGroupGalleryImages(draftImages);
    if (galleryError) {
      setFormError(galleryError);
      return;
    }
    onApply(draftImages);
  };

  const handleClose = () => {
    resetPending();
    onClose();
  };

  const currentImages = draftImages.filter((img) => img.src);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MdPhotoLibrary className="w-5 h-5 text-violet-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate">
              Manage Images (Max {SUBGROUP_GALLERY_SIZE})
            </h3>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Target equipment */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Equipment</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{targetLabel}</p>
          </div>

          {/* Add new image */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Add New Image</p>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Upload File</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200/80 border border-violet-200 rounded-lg"
                >
                  Choose File
                </button>
                <span className="text-xs text-slate-500 truncate max-w-[200px]">
                  {pendingFileName || 'No file chosen'}
                </span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChooseFile} />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Image Description (Mandatory, Min {MIN_GALLERY_CAPTION_LENGTH} Characters)
                </p>
                <span className={`text-[10px] font-bold ${captionValid ? 'text-slate-400' : 'text-rose-500'}`}>
                  {captionLen} / {MIN_GALLERY_CAPTION_LENGTH} min
                </span>
              </div>
              <textarea
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setFormError('');
                }}
                rows={3}
                placeholder={`Enter image description (at least ${MIN_GALLERY_CAPTION_LENGTH} characters)...`}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {formError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleAppend}
              disabled={!canAppend}
              className="w-full py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Append Image
            </button>
          </div>

          {/* Current gallery */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Current Gallery Images
            </p>
            {currentImages.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No images in gallery yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {draftImages.map((image, index) => {
                  if (!image.src) return null;
                  return (
                    <div key={index} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                      <div className="relative aspect-[4/3] bg-slate-100">
                        <img src={image.src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow"
                          aria-label="Remove image"
                        >
                          <MdDelete className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="px-3 py-2.5 border-t border-slate-100 bg-white">
                        <p className="text-xs text-slate-600 leading-snug">{image.caption}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Apply Gallery'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { normalizeDraftImages };
