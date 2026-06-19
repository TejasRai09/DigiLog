import { useEffect, useRef, useState } from 'react';
import {
  MdBadge,
  MdCameraAlt,
  MdClose,
  MdEdit,
} from 'react-icons/md';
import EquipmentSectionShell from './EquipmentSectionShell';
import { resizeImage } from '../../utils/resizeImage';

const DEFAULT_FIELDS = [
  { key: 'equip_no', label: 'Tag / Equipment No.', mono: true },
  { key: 'name', label: 'Name of Equipment', wide: true },
  { key: 'location', label: 'Location' },
  { key: 'commissioned', label: 'Date of Commissioning', date: true },
];

function buildDraftFromEquipment(equipment, fields = DEFAULT_FIELDS) {
  const draft = {};
  for (const { key, date } of fields) {
    draft[key] = date
      ? toDateInputValue(equipment[key])
      : (equipment[key] || '');
  }
  return draft;
}

function toDateInputValue(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dot) {
    return `${dot[3]}-${dot[2].padStart(2, '0')}-${dot[1].padStart(2, '0')}`;
  }
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  return '';
}

function formatCommissionedDisplay(value) {
  if (!value) return '—';
  const iso = toDateInputValue(value);
  if (!iso) return String(value).trim();
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}


function PhotoZone({
  label,
  icon: Icon,
  src,
  isEditing,
  onPick,
  onRemove,
  inputRef,
}) {
  return (
    <div
      onClick={isEditing ? () => inputRef.current?.click() : undefined}
      onKeyDown={isEditing ? (e) => e.key === 'Enter' && inputRef.current?.click() : undefined}
      role={isEditing ? 'button' : undefined}
      tabIndex={isEditing ? 0 : undefined}
      className={`group relative flex flex-col items-center justify-center min-h-[190px] rounded-xl transition-all p-4 overflow-hidden ${
        isEditing
          ? 'border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/10 cursor-pointer'
          : 'border border-slate-200 bg-slate-50/50 cursor-default'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        disabled={!isEditing}
      />

      {src ? (
        <div className="absolute inset-0 w-full h-full bg-slate-900">
          <img src={src} alt={label} className="w-full h-full object-cover opacity-95" />
          {isEditing && (
            <>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/45">
                <span className="text-white text-xs font-semibold bg-slate-900/80 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" /> Change Photo
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute top-2.5 right-2.5 p-1.5 bg-slate-900/90 hover:bg-red-600 text-white rounded-md transition-colors z-10"
                title="Remove image"
              >
                <MdClose className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ) : isEditing ? (
        <div className="text-center">
          <div className="p-3.5 bg-white rounded-full shadow-sm text-slate-400 group-hover:text-blue-500 group-hover:scale-105 transition-all inline-block border border-slate-100">
            <Icon className="w-5 h-5" />
          </div>
          <span className="block mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
          <span className="inline-block mt-1 text-xs font-medium text-blue-600">Click to upload</span>
          <p className="text-[9px] text-slate-400 mt-0.5">Accepts PNG, JPG formats</p>
        </div>
      ) : (
        <div className="text-center p-4">
          <div className="p-3 bg-slate-100/75 text-slate-300 rounded-full inline-block border border-slate-200/40">
            <Icon className="w-5 h-5" />
          </div>
          <span className="block mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
          <span className="inline-block mt-1 text-xs font-medium text-slate-400">No photo uploaded</span>
        </div>
      )}
    </div>
  );
}

function draftImageSrc(imageDraft, type, equipment) {
  if (Object.prototype.hasOwnProperty.call(imageDraft, type)) {
    return imageDraft[type];
  }
  return equipment?.[type] || null;
}

export default function EquipmentLifeHistoryCard({
  equipment,
  saving = false,
  onSave,
  fields = DEFAULT_FIELDS,
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [imageDraft, setImageDraft] = useState({});

  const photoRef = useRef(null);
  const plateRef = useRef(null);

  useEffect(() => {
    if (!equipment) return;
    setDraft(buildDraftFromEquipment(equipment, fields));
  }, [equipment, fields]);

  if (!equipment) return null;

  const resetDrafts = () => {
    setDraft(buildDraftFromEquipment(equipment, fields));
    setImageDraft({});
  };

  const startEdit = () => {
    resetDrafts();
    setIsEditing(true);
  };

  const cancelEdit = () => {
    resetDrafts();
    setIsEditing(false);
  };

  const handlePick = async (e, type) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const b64 = await resizeImage(file);
    setImageDraft((d) => ({ ...d, [type]: b64 }));
  };

  const handleRemoveDraft = (type) => {
    setImageDraft((d) => ({ ...d, [type]: null }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (onSave) await onSave({ fields: draft, images: imageDraft });
      setImageDraft({});
      setIsEditing(false);
    } catch {
      // Stay in edit mode when save fails.
    }
  };

  const photoSrc = isEditing
    ? draftImageSrc(imageDraft, 'photo', equipment)
    : equipment.photo;
  const plateSrc = isEditing
    ? draftImageSrc(imageDraft, 'plate', equipment)
    : equipment.plate;

  return (
    <EquipmentSectionShell
      title="Equipment Life History Card"
      open={!collapsed}
      onToggle={() => setCollapsed((c) => !c)}
    >
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PhotoZone
            label="Equipment Photo"
            icon={MdCameraAlt}
            src={photoSrc}
            isEditing={isEditing}
            inputRef={photoRef}
            onPick={(e) => handlePick(e, 'photo')}
            onRemove={() => handleRemoveDraft('photo')}
          />
          <PhotoZone
            label="Nameplate / Tag"
            icon={MdBadge}
            src={plateSrc}
            isEditing={isEditing}
            inputRef={plateRef}
            onPick={(e) => handlePick(e, 'plate')}
            onRemove={() => handleRemoveDraft('plate')}
          />
        </div>

        <div className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-4 md:p-6">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(({ key, label, mono, date, wide, required = key === 'name' }) => (
                  <div key={key} className={wide ? 'md:col-span-2' : ''}>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      {label}
                    </label>
                    <input
                      type={date ? 'date' : 'text'}
                      required={required}
                      value={draft[key] || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      className={`w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                        mono ? 'font-mono' : key === 'name' ? 'font-semibold text-slate-800' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-y-5 gap-x-6">
              {fields.map(({ key, label, mono, date, wide }) => (
                <div key={key} className={wide ? 'md:col-span-3' : ''}>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {label}
                  </span>
                  {mono ? (
                    <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded inline-block">
                      {equipment[key] || '—'}
                    </span>
                  ) : (
                    <span className={`text-sm font-semibold text-slate-${key === 'name' ? '900' : '800'} block leading-relaxed`}>
                      {date ? formatCommissionedDisplay(equipment[key]) : (equipment[key] || '—')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Registry Active &amp; Synchronized
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm shrink-0"
            >
              <MdEdit className="w-3.5 h-3.5 text-slate-400" />
              Edit Details
            </button>
          </div>
        )}
      </div>
    </EquipmentSectionShell>
  );
}
