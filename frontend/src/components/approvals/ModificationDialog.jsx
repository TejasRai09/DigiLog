import { useState } from 'react';

export default function ModificationDialog({ open, onClose, onSubmit, busy }) {
  const [comment, setComment] = useState('');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">Send for modification</h3>
        <p className="mt-1 text-base text-slate-500">A comment is required so the employee knows what to change.</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          placeholder="Describe the required change"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-base font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !comment.trim()}
            onClick={() => onSubmit(comment.trim())}
            className="rounded-lg bg-amber-600 px-4 py-2 text-base font-bold text-white disabled:opacity-50"
          >
            Send back
          </button>
        </div>
      </div>
    </div>
  );
}
