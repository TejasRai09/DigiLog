import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MdCheck, MdError, MdWarning } from 'react-icons/md';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import AppBrandHeader from '../components/AppBrandHeader';
import useAuth from '../hooks/useAuth';

function ResultIcon({ tone }) {
  const tones = {
    success: {
      Icon: MdCheck,
      ring: 'bg-emerald-50 border-emerald-100',
      icon: 'text-emerald-600',
    },
    warning: {
      Icon: MdWarning,
      ring: 'bg-amber-50 border-amber-100',
      icon: 'text-amber-600',
    },
    error: {
      Icon: MdError,
      ring: 'bg-red-50 border-red-100',
      icon: 'text-red-600',
    },
  };
  const cfg = tones[tone] || tones.success;
  const Icon = cfg.Icon;

  return (
    <div
      className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 shadow-sm ${cfg.ring}`}
    >
      <Icon className={`h-10 w-10 ${cfg.icon}`} />
    </div>
  );
}

function ResultLayout({ children }) {
  const { user } = useAuth();
  const showBrandHeader = !user;

  return (
    <div
      className={`flex flex-col ${
        showBrandHeader ? 'min-h-screen bg-slate-50' : 'min-h-[calc(100vh-4rem)]'
      }`}
    >
      {showBrandHeader && <AppBrandHeader />}
      {children}
    </div>
  );
}

function ResultCard({ tone, title, message }) {
  const titleColors = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  return (
    <ResultLayout>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <ResultIcon tone={tone} />
          <h1 className={`mb-3 text-2xl font-bold ${titleColors[tone] || titleColors.success}`}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>
        </div>
      </div>
    </ResultLayout>
  );
}

export default function MaintenanceApprovalResult({ mode }) {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(mode === 'accept');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== 'accept') return undefined;
    if (!token) {
      setError('Approval link is invalid or missing a token.');
      setLoading(false);
      return undefined;
    }

    api.post('/maintenance-approval/accept', { token })
      .then(({ data }) => setResult(data))
      .catch((err) => setError(err.response?.data?.message || 'Unable to process this request.'))
      .finally(() => setLoading(false));
    return undefined;
  }, [mode, token]);

  const submitModification = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Approval link is invalid or missing a token.');
      return;
    }
    if (!comment.trim()) {
      setError('A comment is required when sending for modification.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/maintenance-approval/reject', { token, comment: comment.trim() });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to process this request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ResultLayout>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </ResultLayout>
    );
  }

  if (mode === 'reject' && !result) {
    return (
      <ResultLayout>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <form onSubmit={submitModification} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="mb-2 text-xl font-bold text-slate-900">Send for modification</h1>
            <p className="mb-4 text-sm text-slate-500">
              Add a comment so the employee can correct this request. The approved record will not change.
            </p>
            {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Describe the required change"
            />
            <button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? 'Sending…' : 'Send for modification'}
            </button>
          </form>
        </div>
      </ResultLayout>
    );
  }

  if (error) {
    return <ResultCard tone="error" title="Unable to process" message={error} />;
  }

  if (mode === 'accept') {
    const when = result?.resolvedAtDisplay;
    return (
      <ResultCard
        tone="success"
        title={result?.alreadyResolved ? 'Already approved' : 'Approved'}
        message={
          result?.alreadyResolved
            ? when
              ? `This maintenance history change for ${result?.equipmentName || 'the equipment'} was already approved on ${when}.`
              : `This maintenance history change for ${result?.equipmentName || 'the equipment'} was already approved.`
            : `The maintenance history entry for ${result?.equipmentName || 'the equipment'} has been saved in DigiLog.`
        }
      />
    );
  }

  const when = result?.resolvedAtDisplay;
  return (
    <ResultCard
      tone="warning"
      title={result?.alreadyResolved ? 'Already processed' : 'Sent for modification'}
      message={
        result?.alreadyResolved
          ? when
            ? `This request for ${result?.equipmentName || 'the equipment'} was already sent back for modification on ${when}.`
            : `This request for ${result?.equipmentName || 'the equipment'} was already sent back for modification.`
          : `The submitter has been asked to modify the entry for ${result?.equipmentName || 'the equipment'}.`
      }
    />
  );
}
