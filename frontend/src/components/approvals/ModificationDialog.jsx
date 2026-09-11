import { useState } from 'react';
import { createPortal } from 'react-dom';
import BusyButton from './BusyButton.jsx';

export default function ModificationDialog({ open, onClose, onSubmit, busy }) {
  const [comment, setComment] = useState('');
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      <div className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">Send for modification</h3>
        <p className="mt-1 text-base text-slate-500">A comment is required so the employee knows what to change.</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-base disabled:opacity-60"
          placeholder="Describe the required change"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-base font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <BusyButton
            busy={busy}
            busyLabel="Sending…"
            disabled={!comment.trim()}
            onClick={() => onSubmit(comment.trim())}
            className="rounded-lg bg-amber-600 px-4 py-2 text-base font-bold text-white disabled:opacity-50"
          >
            Send back
          </BusyButton>
        </div>
      </div>
    </div>,
    document.body
  );
}
