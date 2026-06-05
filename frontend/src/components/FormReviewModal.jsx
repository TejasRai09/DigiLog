import { useEffect } from 'react';
import { MdCheck, MdClose, MdInfoOutline, MdSwapHoriz } from 'react-icons/md';
import Spinner from './Spinner';

const ConfirmationPolicyNotice = () => (
  <div
    className="flex gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5 md:px-5"
    role="note"
  >
    <MdInfoOutline
      className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 sm:h-5 sm:w-5"
      aria-hidden
    />
    <div className="min-w-0">
      <p className="text-xs font-bold text-amber-900 sm:text-sm">Confirmation Policy Notice</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/90 sm:mt-1.5 sm:text-sm">
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
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
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close review"
        onClick={confirming ? undefined : onClose}
      />

      <div className="relative my-auto flex w-full max-w-4xl max-h-[min(calc(100dvh-1.5rem),880px)] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 md:px-8 md:py-5">
          <div className="min-w-0 pr-1">
            <h2 id="form-review-title" className="text-lg font-bold leading-snug text-[#0f4c5c] sm:text-xl md:text-2xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs leading-snug text-gray-500 sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4 md:px-8">
          {summary.length > 0 ? (
            <div className="mb-4 rounded-xl bg-gray-100/90 px-4 py-3 sm:px-5 sm:py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
                      <p className="mt-0.5 break-words text-sm font-bold text-gray-900 sm:text-base">
                        {value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div
            className={
              twoColumn ? 'grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-8' : 'max-w-3xl'
            }
          >
            {sections.map((section) => (
              <div
                key={section.title}
                className={
                  section.variant === 'highlight' ? 'rounded-xl bg-sky-50/80 p-3 sm:p-4 md:p-5' : ''
                }
              >
                <h3
                  className={`mb-3 text-xs font-bold uppercase tracking-wide sm:mb-4 ${titleClass(section.titleTone)}`}
                >
                  {section.title}
                </h3>
                {section.fields.length === 0 ? (
                  <p className="text-sm text-gray-500">No values entered.</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 sm:gap-y-3">
                    {section.fields.map(({ label, value }) => (
                      <div key={`${section.title}-${label}`}>
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:text-[11px]">
                          {label}
                        </dt>
                        <dd
                          className={`mt-0.5 break-words text-sm font-bold ${
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

          <div className="mt-4 sm:mt-5">
            <ConfirmationPolicyNotice />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4 md:px-8">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="btn-primary order-1 w-full bg-[#1e40af] hover:bg-[#1e3a8a] sm:order-2 sm:min-w-[11rem] sm:w-auto"
          >
            {confirming ? <Spinner size="sm" /> : <MdCheck className="h-4 w-4" />}
            {confirming ? 'Committing…' : 'Confirm & Commit'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="btn-secondary order-2 w-full sm:order-1 sm:min-w-[9rem] sm:w-auto"
          >
            <MdSwapHoriz className="h-4 w-4" />
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormReviewModal;
