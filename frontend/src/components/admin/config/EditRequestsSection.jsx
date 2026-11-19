import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';
import { EVENT_NOTIFICATION_NEW, onRealtimeEvent } from '../../../realtime/socket';
import {
  formatRecordCellForDisplay,
  getDisplayColumns,
  headerLabel,
} from '../../../config/formColumnSchemas';
import FormReviewModal from '../../FormReviewModal';

function fieldLabel(formKey, key, sample) {
  const col = getDisplayColumns(formKey, sample).find((item) => item.dbKey === key);
  return col ? headerLabel(col) : key;
}

function valuesDiffer(before, after) {
  const blank = (value) => value == null || value === '';
  if (blank(before) && blank(after)) return false;
  const left = Number(before);
  const right = Number(after);
  if (!blank(before) && !blank(after) && !Number.isNaN(left) && !Number.isNaN(right)) {
    return left !== right;
  }
  return String(before ?? '') !== String(after ?? '');
}

function showValue(formKey, key, value, sample) {
  if (value == null || value === '') return '—';
  return formatRecordCellForDisplay(key, value, formKey, sample);
}

export default function EditRequestsSection() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [review, setReview] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/form-edit-requests?status=${status}`);
      setRequests(data.requests || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load edit requests.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
    if (payload?.type === 'form_edit_request_new') load();
  }), [load]);

  const decide = async (id, action) => {
    setBusyId(id);
    try {
      await api.post(`/admin/form-edit-requests/${id}/${action}`);
      toast.success(action === 'approve' ? 'Edit request approved.' : 'Edit request rejected.');
      setReview(null);
      window.dispatchEvent(new Event('edit-requests-changed'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ConfigSectionPanel
      title="Edit Requests"
      description="Approve a request to update the saved row. Reject leaves the row unchanged and tells the user."
    >
      <div className="mb-4 flex gap-2">
        {['pending', 'approved', 'rejected'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
              status === item ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No {status} edit requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-2 py-2">User name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Department</th>
                <th className="px-2 py-2">Form name</th>
                <th className="px-2 py-2">Sub form name</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {requests.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="px-2 py-2">{row.userName}</td>
                  <td className="px-2 py-2">{row.email}</td>
                  <td className="px-2 py-2">{row.department || '—'}</td>
                  <td className="px-2 py-2">{row.appName || '—'}</td>
                  <td className="px-2 py-2">{row.formName}</td>
                  <td className="px-2 py-2 capitalize">{row.status}</td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setReview(row)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {review ? (
        <ReviewDialog
          request={review}
          busy={busyId === review.id}
          onClose={() => setReview(null)}
          onApprove={() => decide(review.id, 'approve')}
          onReject={() => decide(review.id, 'reject')}
        />
      ) : null}
    </ConfigSectionPanel>
  );
}

function reviewFields(request) {
  const sample = { ...request.before, ...request.after };
  const columns = getDisplayColumns(request.formKey, sample);
  const keys = Object.keys(request.after || {});
  const ordered = columns.filter((col) => keys.includes(col.dbKey));
  const known = new Set(ordered.map((col) => col.dbKey));
  const extras = keys
    .filter((key) => !known.has(key))
    .map((key) => ({ dbKey: key, heading: 'Additional', subheading: key }));
  return [...ordered, ...extras].map((col) => {
    const changed = valuesDiffer(request.before?.[col.dbKey], request.after?.[col.dbKey]);
    return {
      key: col.dbKey,
      heading: col.heading || 'Details',
      label: fieldLabel(request.formKey, col.dbKey, sample),
      before: showValue(request.formKey, col.dbKey, request.before?.[col.dbKey], sample),
      after: showValue(request.formKey, col.dbKey, request.after?.[col.dbKey], sample),
      changed,
    };
  });
}

function ReviewDialog({ request, busy, onClose, onApprove, onReject }) {
  const sections = [];
  let current = null;
  for (const field of reviewFields(request)) {
    if (!current || current.title !== field.heading) {
      current = { title: field.heading, fields: [] };
      sections.push(current);
    }
    current.fields.push({
      label: field.label,
      value: field.changed ? (
        <span className="block">
          <span className="block text-xs font-medium text-gray-400 line-through">{field.before}</span>
          <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-amber-950">{field.after}</span>
        </span>
      ) : field.after,
    });
  }
  return (
    <FormReviewModal
      open
      title="Review edit request"
      subtitle={`${request.userName} · ${request.appName || '—'} · ${request.formName}`}
      sections={sections}
      preface={(
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Comment</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{request.comment || '—'}</p>
        </div>
      )}
      onClose={onClose}
      onConfirm={request.status === 'pending' ? onApprove : onClose}
      confirming={busy}
      confirmLabel={request.status === 'pending' ? 'Approve' : 'Close'}
      confirmingLabel="Saving…"
      backLabel={request.status === 'pending' ? 'Close' : ''}
      notice={null}
      overlayClassName="z-[80]"
      secondaryAction={request.status === 'pending' ? { label: 'Reject', onClick: onReject } : null}
    />
  );
}
