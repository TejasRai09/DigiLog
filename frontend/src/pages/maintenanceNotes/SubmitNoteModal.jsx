import { useState } from 'react';
import ModalPortal from '../../components/ModalPortal';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

export default function SubmitNoteModal({ note, onClose, onDone }) {
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  if (!note) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/maintenance-notes/${note.id}/submit`, { completionRemarks });
      toast.success('Sent to the plant HOD for completion approval.');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit for approval.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <h2 className="text-lg font-bold text-slate-900">Submit for completion</h2>
        <p className="mt-1 text-sm text-slate-500">
          Confirm that the work for <span className="font-semibold">{note.noteId}</span> has been carried out.
          The plant HOD must approve before this note is marked Completed.
        </p>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {note.activityType ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{note.activityType}</p>
          ) : null}
          <p className="whitespace-pre-wrap">{note.activityDescription}</p>
          {note.activityDetails ? (
            <p className="mt-1 whitespace-pre-wrap text-slate-500">{note.activityDetails}</p>
          ) : null}
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Completion remarks (optional)</label>
        <textarea
          value={completionRemarks}
          onChange={(e) => setCompletionRemarks(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="What was done, or any note for the HOD"
        />
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 sm:w-auto">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
          >
            {saving ? <Spinner size="sm" /> : null}
            Submit for approval
          </button>
        </div>
      </form>
    </div>
    </ModalPortal>
  );
}
