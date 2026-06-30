import { useState } from 'react';
import {
  MdClose,
  MdExpandLess,
  MdExpandMore,
  MdMenu,
} from 'react-icons/md';
import ManageGalleryModal from './ManageGalleryModal';
import {
  formatCommissionedDisplay,
  getSubGroupMetaEntry,
  toDateInputValue,
} from '../../utils/equipmentSpecModel';

const DETAIL_FIELDS = [
  { label: 'Card name', key: 'name' },
  { label: 'Tag No.', key: 'tagNo', mono: true },
  { label: 'Equipment No.', key: 'equipNo', mono: true },
  { label: 'Location', key: 'location' },
  { label: 'Date of Commissioning', key: 'commissioned', date: true },
];

function MetaField({ label, value }) {
  const display = String(value || '').trim() || '--';
  return (
    <p className="text-xs text-slate-500 leading-relaxed">
      <span className="font-bold text-slate-400">{label}:</span>{' '}
      <span className={`font-semibold ${display === '--' ? 'text-slate-400' : 'text-slate-700'}`}>{display}</span>
    </p>
  );
}

function MetaInline({ label, value }) {
  const display = String(value || '').trim() || '--';
  return (
    <span className="text-xs text-slate-500 whitespace-nowrap">
      <span className="font-bold text-slate-400">{label}:</span>{' '}
      <span className={`font-semibold ${display === '--' ? 'text-slate-400' : 'text-slate-700'}`}>{display}</span>
    </span>
  );
}

function displayCell(value) {
  const text = String(value ?? '').trim();
  return text || '--';
}

function SpecParameterTable({ subSpecs }) {
  return (
    <div className="mx-3 sm:mx-5 mb-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 px-3 sm:px-5 py-3 border-b border-slate-200 bg-slate-100/90">
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Specification Parameter
        </div>
        <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Value
        </div>
      </div>

      {subSpecs.length === 0 ? (
        <p className="px-3 sm:px-5 py-8 text-sm text-slate-400 text-center">No specifications recorded.</p>
      ) : (
        <div>
          {subSpecs.map((item, index) => {
            const label = displayCell(item.label);
            const value = displayCell(item.value);
            const isLast = index === subSpecs.length - 1;
            return (
              <div
                key={item.id}
                className={`grid grid-cols-2 gap-3 sm:gap-6 px-3 sm:px-5 py-3 sm:py-3.5 items-start ${
                  isLast ? '' : 'border-b border-slate-100'
                }`}
              >
                <div
                  className={`text-xs sm:text-sm font-semibold leading-snug ${
                    label === '--' ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  {label}
                </div>
                <div
                  className={`text-xs sm:text-sm font-normal leading-snug break-words ${
                    value === '--' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GalleryThumb({ image, onView, compact = false }) {
  if (!image.src) return null;

  return (
    <div className={compact ? 'min-w-0 w-full' : 'shrink-0 w-[200px] sm:w-[220px]'}>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => onView(image.src, image.caption)}
          className="aspect-[4/3] bg-slate-100 w-full block cursor-zoom-in"
        >
          <img src={image.src} alt="" className="w-full h-full object-cover" />
        </button>
        <div className="px-2 py-1.5 sm:px-2.5 sm:py-2 border-t border-slate-100 bg-white min-h-[2rem] sm:min-h-[2.5rem]">
          <p className="text-[10px] text-slate-500 truncate sm:line-clamp-2 sm:whitespace-normal leading-snug">
            {image.caption || '--'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SpecSubGroupPanel({
  sectionId,
  subName,
  subSpecs,
  subGroupMeta,
  equipmentDefaults,
  collapsed,
  onToggle,
  onMetaChange,
  onOpenParamModal,
  onDeleteSubGroup,
  onRenameSubGroup,
  onPersistMeta,
  saving = false,
}) {
  const [lightbox, setLightbox] = useState(null);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState(null);

  const meta = getSubGroupMetaEntry(subGroupMeta, sectionId, subName, equipmentDefaults);
  const imageCount = meta.images.filter((img) => img.src).length;
  const imageLabel = imageCount === 0 ? 'No Images' : `${imageCount} Image${imageCount !== 1 ? 's' : ''}`;
  const targetLabel = `${subName}${meta.tagNo ? ` (${meta.tagNo})` : ''}`;

  const openDetails = () => {
    setDetailsDraft({
      name: subName,
      tagNo: meta.tagNo,
      equipNo: meta.equipNo,
      location: meta.location,
      commissioned: toDateInputValue(meta.commissioned),
    });
    setDetailsOpen(true);
  };

  const saveDetails = async () => {
    const trimmedName = detailsDraft.name.trim();
    if (!trimmedName) return;
    await onRenameSubGroup(sectionId, subName, trimmedName, {
      tagNo: detailsDraft.tagNo,
      equipNo: detailsDraft.equipNo,
      location: detailsDraft.location,
      commissioned: detailsDraft.commissioned,
    });
    setDetailsOpen(false);
  };

  const applyGallery = async (images) => {
    const nextMeta = { ...meta, images };
    onMetaChange(sectionId, subName, nextMeta);
    await onPersistMeta(sectionId, subName, nextMeta);
    setGalleryModalOpen(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${subName}" and all its data?`)) return;
    await onDeleteSubGroup(sectionId, subName);
  };

  return (
    <>
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-4">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 sm:mt-1 text-slate-300 shrink-0">
              <MdMenu className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm sm:text-lg font-bold text-slate-900 leading-snug truncate pr-1">
                  {subName}
                </h4>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="text-[10px] sm:text-[11px] font-bold text-violet-700 bg-violet-100 border border-violet-200/80 px-2 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    {subSpecs.length} spec{subSpecs.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    <span className="whitespace-nowrap lowercase sm:normal-case">{imageLabel}</span>
                    {collapsed ? (
                      <MdExpandMore className="w-5 h-5 text-slate-400 shrink-0" />
                    ) : (
                      <MdExpandLess className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 sm:hidden">
                <MetaField label="TAG" value={meta.tagNo} />
                <MetaField label="No" value={meta.equipNo} />
                <MetaField label="Location" value={meta.location} />
                <MetaField label="Date of Commissioning" value={formatCommissionedDisplay(meta.commissioned)} />
              </div>
              <div className="mt-2 hidden sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                <MetaInline label="TAG" value={meta.tagNo} />
                <MetaInline label="No" value={meta.equipNo} />
                <MetaInline label="Location" value={meta.location} />
                <MetaInline label="Date of Commissioning" value={formatCommissionedDisplay(meta.commissioned)} />
              </div>
            </div>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="border-t border-slate-100 pt-4">
              <SpecParameterTable subSpecs={subSpecs} />
            </div>

            <div className="px-3 sm:px-5 py-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Equipment Gallery
              </p>
              {imageCount === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No images uploaded.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:hidden">
                    {meta.images.map((image, index) => (
                      <GalleryThumb
                        key={index}
                        image={image}
                        compact
                        onView={(src, caption) => setLightbox({ src, caption })}
                      />
                    ))}
                  </div>
                  <div className="hidden sm:flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {meta.images.map((image, index) => (
                      <GalleryThumb
                        key={index}
                        image={image}
                        onView={(src, caption) => setLightbox({ src, caption })}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div className="px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => onOpenParamModal(sectionId, subName)}
              className="w-full px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200/80 rounded-lg transition-colors text-center"
            >
              Manage Specs
            </button>
            <button
              type="button"
              onClick={() => setGalleryModalOpen(true)}
              disabled={saving}
              className="w-full px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200/80 rounded-lg transition-colors disabled:opacity-60 text-center"
            >
              Manage Gallery
            </button>
            <button
              type="button"
              onClick={openDetails}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors text-center"
            >
              Rename / Details
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="w-full px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-60 text-center"
            >
              Delete Card
            </button>
          </div>

          <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenParamModal(sectionId, subName)}
                className="px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200/80 rounded-lg transition-colors whitespace-nowrap"
              >
                Manage Specs
              </button>
              <button
                type="button"
                onClick={() => setGalleryModalOpen(true)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200/80 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                Manage Gallery
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openDetails}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap"
              >
                Rename / Details
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      </div>

      <ManageGalleryModal
        open={galleryModalOpen}
        targetLabel={targetLabel}
        initialImages={meta.images}
        onClose={() => setGalleryModalOpen(false)}
        onApply={applyGallery}
        saving={saving}
      />

      {detailsOpen && detailsDraft && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Rename / Details</h3>
              <button type="button" onClick={() => setDetailsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {DETAIL_FIELDS.map(({ label, key, mono, date }) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
                  <input
                    type={date ? 'date' : 'text'}
                    value={date ? toDateInputValue(detailsDraft[key]) : detailsDraft[key]}
                    onChange={(e) => setDetailsDraft((d) => ({ ...d, [key]: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 ${mono ? 'font-mono' : ''}`}
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDetails}
                disabled={saving || !detailsDraft.name.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/95 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="w-full max-w-3xl flex justify-end text-white mb-2 px-2">
            <button type="button" onClick={() => setLightbox(null)} className="text-slate-300 hover:text-white p-1">
              <MdClose className="w-5 h-5" />
            </button>
          </div>
          {lightbox.caption && (
            <p className="text-xs text-slate-300 mb-2 max-w-3xl text-center">{lightbox.caption}</p>
          )}
          <img
            src={lightbox.src}
            alt=""
            className="max-w-full max-h-[75vh] object-contain rounded-xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
