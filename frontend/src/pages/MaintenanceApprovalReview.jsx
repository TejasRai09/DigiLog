import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import AppBrandHeader from '../components/AppBrandHeader';
import useAuth from '../hooks/useAuth';

function ReviewLayout({ children }) {
  const { user } = useAuth();
  return (
    <div className={`flex flex-col bg-slate-50 ${user ? 'min-h-[calc(100vh-4rem)]' : 'min-h-screen'}`}>
      {!user && <AppBrandHeader />}
      {children}
    </div>
  );
}

export default function MaintenanceApprovalReview() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Review link is invalid or missing a token.');
      setLoading(false);
      return;
    }
    api.post('/maintenance-approval/review', { token })
      .then(({ data }) => setReview(data))
      .catch((err) => setError(err.response?.data?.message || 'Unable to load this request.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <ReviewLayout>
        <div className="flex flex-1 items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </ReviewLayout>
    );
  }

  if (error) {
    return (
      <ReviewLayout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-red-600">Unable to review</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </ReviewLayout>
    );
  }

  if (review?.alreadyResolved || review?.status !== 'pending') {
    const when = review?.resolvedAtDisplay;
    const approved = review?.status === 'approved';
    return (
      <ReviewLayout>
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className={`text-xl font-bold ${approved ? 'text-emerald-600' : 'text-amber-600'}`}>
            {approved ? 'Already approved' : 'Already processed'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {approved
              ? (when
                ? `This maintenance history change for ${review.equipmentName} was already approved on ${when}.`
                : `This maintenance history change for ${review.equipmentName} was already approved.`)
              : (when
                ? `This request for ${review.equipmentName} was already ${review.status} on ${when}.`
                : `This request was already ${review.status}.`)}
          </p>
        </div>
      </ReviewLayout>
    );
  }

  const acceptHref = `/api/maintenance-approval/accept?token=${encodeURIComponent(review.acceptToken)}`;
  const rejectHref = `/api/maintenance-approval/reject?token=${encodeURIComponent(review.rejectToken)}`;

  return (
    <ReviewLayout>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Review maintenance history change</h1>
          <p className="mt-1 text-sm text-slate-500">
            {review.domainLabel} · {review.actionLabel}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Equipment: <span className="font-semibold text-slate-800">{review.equipmentName}</span>
          </p>
          <p className="text-sm text-slate-600">
            Submitted by {review.submitterName}
            {review.submitterEmail ? ` (${review.submitterEmail})` : ''}
          </p>
          {review.tokenExpiresAtDisplay ? (
            <p className="mt-1 text-xs text-slate-400">This link expires on {review.tokenExpiresAtDisplay}.</p>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">Field</th>
                  <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">Previous</th>
                  <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">New</th>
                </tr>
              </thead>
              <tbody>
                {(review.diff || []).length ? review.diff.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700">{row.label}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-500 whitespace-pre-wrap">{row.oldValue}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-800 whitespace-pre-wrap">{row.newValue}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="border border-slate-200 px-3 py-4 text-slate-400">No field details available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {review.photosBefore?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Before photos</p>
              <div className="grid grid-cols-3 gap-2">
                {review.photosBefore.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-24 w-full rounded-lg border border-slate-200 object-cover" />
                ))}
              </div>
            </div>
          )}
          {review.photosAfter?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">After photos</p>
              <div className="grid grid-cols-3 gap-2">
                {review.photosAfter.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-24 w-full rounded-lg border border-slate-200 object-cover" />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <a href={acceptHref} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
              Accept
            </a>
            <a href={rejectHref} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
              Send for modification
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Accept saves this entry only. Other pending items in the digest are not changed.
          </p>
        </div>
      </main>
    </ReviewLayout>
  );
}
