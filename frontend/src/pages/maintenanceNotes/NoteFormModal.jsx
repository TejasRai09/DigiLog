import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import Spinner from '../../components/Spinner';
import { ACTIVITY_MAX_LENGTH, ACTIVITY_TYPES, PLANTS } from './noteStatus';
import { lockedPlantForUser } from '../../utils/maintenanceNotesPlantAccess';
import EquipmentTreeSelect from './EquipmentTreeSelect';
import {
  MAX_NOTE_DOCUMENTS,
  MAX_NOTE_PHOTOS,
  NoteDocumentGrid,
  NotePhotoGrid,
  uploadNoteDocument,
} from './NoteAttachmentFields';

export default function NoteFormModal({ open, note, viewOnly, onClose, onSaved }) {
  const { user } = useAuth();
  const lockedPlant = lockedPlantForUser(user);
  const plantLocked = Boolean(lockedPlant);
  const [savedId, setSavedId] = useState(null);
  const [plant, setPlant] = useState(lockedPlant || 'sugar');
  const [noEquipment, setNoEquipment] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [equipmentNodeId, setEquipmentNodeId] = useState(null);
  const [equipmentId, setEquipmentId] = useState(null);
  const [equipmentFallback, setEquipmentFallback] = useState('');
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [activityType, setActivityType] = useState('');
  const [activity, setActivity] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(savedId);

  useEffect(() => {
    if (!open) return;
    const rawActivity = note?.activityDescription || '';
    const existingDetails = note?.activityDetails || '';
    setSavedId(note?.id || null);
    setPlant(note?.plant || lockedPlant || 'sugar');
    setNoEquipment(Boolean(note?.noEquipment));
    setEquipmentNodeId(note?.equipmentNodeId || null);
    setEquipmentId(note?.equipmentId || null);
    setSelectedId(note?.equipmentNodeId ? String(note.equipmentNodeId) : (note?.equipmentId ? String(note.equipmentId) : ''));
    setEquipmentFallback(note?.noEquipment ? '' : (note?.equipmentName || ''));
    setActivityType(note?.activityType || '');
    if (rawActivity.length > ACTIVITY_MAX_LENGTH && !existingDetails) {
      setActivity(rawActivity.slice(0, ACTIVITY_MAX_LENGTH));
      setDetails(rawActivity);
    } else {
      setActivity(rawActivity.slice(0, ACTIVITY_MAX_LENGTH));
      setDetails(existingDetails);
    }
    setPhotos(Array.isArray(note?.images) ? note.images : []);
    setDocuments((note?.documents || []).map((doc) => ({ ...doc, pending: false, file: null })));
  }, [open, note, lockedPlant]);

  useEffect(() => {
    if (!open || noEquipment) return undefined;
    let cancelled = false;
    setTreeLoading(true);
    api.get('/maintenance-notes/equipment-tree', { params: { plant } })
      .then(({ data }) => {
        if (!cancelled) setTree(data.nodes || []);
      })
      .catch(() => {
        if (!cancelled) {
          setTree([]);
          toast.error('Could not load equipment for this plant.');
        }
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, plant, noEquipment]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!activityType) {
      toast.error('Select an activity type.');
      return;
    }
    if (!activity.trim()) {
      toast.error('Activity is required.');
      return;
    }
    if (!noEquipment && !equipmentNodeId && !equipmentId) {
      toast.error('Select an equipment, or mark the note as not related to a specific equipment.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        plant,
        noEquipment,
        equipmentNodeId: noEquipment ? null : equipmentNodeId,
        equipmentId: noEquipment ? null : equipmentId,
        activityType,
        activityDescription: activity.trim(),
        activityDetails: details.trim(),
        images: photos,
        documents: documents
          .filter((doc) => doc.storageKey && !doc.pending)
          .map(({ storageKey, displayName, originalName, mimeType, size }) => ({
            storageKey,
            displayName,
            originalName,
            mimeType,
            size,
          })),
      };
      const { data } = savedId
        ? await api.put(`/maintenance-notes/${savedId}`, payload)
        : await api.post('/maintenance-notes', payload);
      const noteId = data.id;
      setSavedId(noteId);
      const nextDocs = documents.map((doc) => ({ ...doc }));
      for (let i = 0; i < nextDocs.length; i += 1) {
        const doc = nextDocs[i];
        if (!doc.pending || !doc.file) continue;
        const saved = await uploadNoteDocument(noteId, doc.file, doc.displayName);
        nextDocs[i] = { ...saved, pending: false, file: null };
        setDocuments(nextDocs.map((item) => ({ ...item })));
      }
      toast.success(savedId ? 'Note updated.' : 'Maintenance note added.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the note.');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <h2 className="text-lg font-bold text-slate-900">
          {viewOnly ? 'Maintenance note' : isEdit ? 'Edit maintenance note' : 'Add maintenance note'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {plantLocked
            ? 'Plant is set from your employee category. Equipment comes from that plant’s hierarchy.'
            : 'Plant decides which HOD can close the note. Equipment comes from that plant’s hierarchy.'}
        </p>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Plant<span className="ml-0.5 text-red-500">*</span>
        </label>
        <select
          value={plant}
          disabled={viewOnly || plantLocked}
          onChange={(e) => {
            setPlant(e.target.value);
            setSelectedId('');
            setEquipmentNodeId(null);
            setEquipmentId(null);
            setEquipmentFallback('');
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-700"
          required
        >
          {(plantLocked ? PLANTS.filter((p) => p.key === plant) : PLANTS).map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>

        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={noEquipment}
            disabled={viewOnly}
            onChange={(e) => {
              const checked = e.target.checked;
              setNoEquipment(checked);
              if (checked) {
                setSelectedId('');
                setEquipmentNodeId(null);
                setEquipmentId(null);
              }
            }}
          />
          <span>Not related to a specific equipment</span>
        </label>

        {noEquipment ? null : (
          <div className="mt-3">
            <label className="block text-sm font-semibold text-slate-700">
              Equipment<span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="mt-1">
              <EquipmentTreeSelect
                nodes={tree}
                selectedId={selectedId}
                disabled={viewOnly}
                loading={treeLoading}
                onSelect={(node) => {
                  setSelectedId(String(node.id));
                  setEquipmentNodeId(node.nodeId || null);
                  setEquipmentId(node.equipmentId || null);
                  setEquipmentFallback('');
                }}
              />
            </div>
            {equipmentFallback && !selectedId ? (
              <p className="mt-1 text-xs text-amber-700">
                Previously recorded as “{equipmentFallback}”. Choose it again from the list.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Open a group, then choose the equipment.</p>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Activity type<span className="text-red-500"> *</span>
            </label>
            <select
              value={activityType}
              disabled={viewOnly}
              onChange={(e) => setActivityType(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">Select...</option>
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Activity (short text)<span className="text-red-500"> *</span>
            </label>
            <input
              value={activity}
              disabled={viewOnly}
              maxLength={ACTIVITY_MAX_LENGTH}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="e.g. Replace governor oil and clean filter"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{activity.length}/{ACTIVITY_MAX_LENGTH}</p>
          </div>
        </div>

        <label className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Details (optional)
        </label>
        <textarea
          value={details}
          disabled={viewOnly}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Scope, spares needed, observations"
        />

        <div className="mt-5">
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Photos (max {MAX_NOTE_PHOTOS})
          </label>
          <div className="w-full sm:w-1/2">
            <NotePhotoGrid photos={photos} onChange={setPhotos} disabled={viewOnly} />
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Photos are resized before upload, so large camera images are fine.</p>
        </div>

        <div className="mt-5">
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Documents (max {MAX_NOTE_DOCUMENTS}, 10 MB each)
          </label>
          <div className="w-full sm:w-1/2">
            <NoteDocumentGrid documents={documents} onChange={setDocuments} disabled={viewOnly} />
          </div>
          <p className="mt-2 text-[10px] text-slate-400">PDF or Word</p>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 sm:w-auto">
            {viewOnly ? 'Close' : 'Cancel'}
          </button>
          {viewOnly ? null : (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {saving ? <Spinner size="sm" /> : null}
              {isEdit ? 'Save changes' : 'Add note'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
