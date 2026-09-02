import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MdCheckCircle, MdError, MdWarning } from 'react-icons/md';
import api from '../api/axios';
import Spinner from '../components/Spinner';

function ResultCard({ tone, title, message }) {
  const tones = {
    success: { icon: MdCheckCircle, className: 'text-emerald-600', bg: 'bg-emerald-50' },
    warning: { icon: MdWarning, className: 'text-amber-600', bg: 'bg-amber-50' },
    error: { icon: MdError, className: 'text-red-600', bg: 'bg-red-50' },
  };
  const cfg = tones[tone] || tones.success;
  const Icon = cfg.icon;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${cfg.bg}`}>
          <Icon className={`w-8 h-8 ${cfg.className}`} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

export default function MaintenanceApprovalResult({ mode }) {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Approval link is invalid or missing a token.');
      setLoading(false);
      return;
    }

    const endpoint = mode === 'accept' ? '/maintenance-approval/accept' : '/maintenance-approval/reject';
    api.post(endpoint, { token })
      .then(({ data }) => setResult(data))
      .catch((err) => setError(err.response?.data?.message || 'Unable to process this request.'))
      .finally(() => setLoading(false));
  }, [mode, token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ResultCard tone="error" title="Unable to process" message={error} />;
  }

  if (mode === 'accept') {
    return (
      <ResultCard
        tone="success"
        title={result?.alreadyResolved ? 'Already approved' : 'Approved'}
        message={
          result?.alreadyResolved
            ? `This maintenance history change for ${result?.equipmentName || 'the equipment'} was already approved.`
            : `The maintenance history entry for ${result?.equipmentName || 'the equipment'} has been saved in DigiLog.`
        }
      />
    );
  }

  return (
    <ResultCard
      tone="warning"
      title={result?.alreadyResolved ? 'Already processed' : 'Sent for modification'}
      message={
        result?.alreadyResolved
          ? `This request for ${result?.equipmentName || 'the equipment'} was already sent back for modification.`
          : `The submitter has been notified that the entry for ${result?.equipmentName || 'the equipment'} was not saved in DigiLog.`
      }
    />
  );
}
