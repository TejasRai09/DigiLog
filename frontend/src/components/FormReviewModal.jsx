import { useEffect } from 'react';
import { MdCheck, MdClose, MdInfoOutline, MdSwapHoriz } from 'react-icons/md';
import Spinner from './Spinner';

const ConfirmationPolicyNotice = () => (
  <div
    className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 sm:px-5"
    role="note"
  >
    <MdInfoOutline
      className="mt-0.5 h-5 w-5 shrink-0 text-amber-800"
      aria-hidden
    />
    <div>
      <p className="text-sm font-bold text-amber-900">Confirmation Policy Notice</p>
      <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
        By pressing <span className="font-bold">Confirm &amp; Commit</span>, you certify that these
        measurements are accurate representations of today&apos;s plant production. This entry will be
        permanently appended to the operations register database.
      </p>
    </div>
  </div>
);

const FormReviewModal = ({
  open,
  title,
  subtitle,
  summary = [],
  sections = [],
  onClose,
  onConfirm,
  confirming = false,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, confirming, onClose]);

  if (!open) return null;

  const twoColumn = sections.length > 1;

  const titleClass = (tone) => {
    if (tone === 'navy') return 'text-[#1e3a5f]';
    if (tone === 'teal') return 'text-teal-700';
    return 'text-gray-800';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close review"
        onClick={confirming ? undefined : onClose}
      />

      <div className="relative flex max-h-[min(92vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:px-8">
          <div>
            <h2 id="form-review-title" className="text-xl font-bold text-[#0f4c5c] sm:text-2xl">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        {summary.length > 0 ? (
          <div className="mx-6 mt-5 rounded-xl bg-gray-100/90 px-5 py-4 sm:mx-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {summary.map(({ label, value, badge }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {label}
                  </p>
                  {badge ? (
                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-3 py-0.5 text-sm font-semibold text-amber-800">
                      {value}
                    </span>
                  ) : (
                    <p className="mt-0.5 text-base font-bold text-gray-900">{value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <div
            className={
              twoColumn ? 'grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8' : 'max-w-3xl'
            }
          >
            {sections.map((section) => (
              <div
                key={section.title}
                className={
                  section.variant === 'highlight' ? 'rounded-xl bg-sky-50/80 p-4 sm:p-5' : ''
                }
              >
                <h3
                  className={`mb-4 text-xs font-bold uppercase tracking-wide ${titleClass(section.titleTone)}`}
                >
                  {section.title}
                </h3>
                {section.fields.length === 0 ? (
                  <p className="text-sm text-gray-500">No values entered.</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {section.fields.map(({ label, value }) => (
                      <div key={`${section.title}-${label}`}>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                          {label}
                        </dt>
                        <dd
                          className={`mt-0.5 text-sm font-bold ${
                            section.variant === 'highlight'
                              ? 'text-[#1e3a5f]'
                              : 'text-gray-900'
                          }`}
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 sm:px-8">
          <ConfirmationPolicyNotice />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="btn-secondary min-w-[9rem]"
          >
            <MdSwapHoriz className="h-4 w-4" />
            Back to Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="btn-primary min-w-[11rem] bg-[#1e40af] hover:bg-[#1e3a8a]"
          >
            {confirming ? <Spinner size="sm" /> : <MdCheck className="h-4 w-4" />}
            {confirming ? 'Committing…' : 'Confirm & Commit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormReviewModal;
