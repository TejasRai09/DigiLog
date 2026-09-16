import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import useFormsHubViewOnly from './useFormsHubViewOnly';
import { FORMS_HUB_VIEW_ONLY_MESSAGE } from '../components/FormsHubViewOnlyBanner';

/**
 * Opens a review modal on submit; runs `submit` only after user confirms.
 */
export function useGsmaFormReview({ validate, submit }) {
  const viewOnly = useFormsHubViewOnly();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openReview = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (viewOnly) {
        toast.error(FORMS_HUB_VIEW_ONLY_MESSAGE);
        return;
      }
      if (validate?.() === false) return;
      setReviewOpen(true);
    },
    [validate, viewOnly],
  );

  const closeReview = useCallback(() => {
    if (!submitting) setReviewOpen(false);
  }, [submitting]);

  const confirmSubmit = useCallback(async () => {
    if (viewOnly) {
      toast.error(FORMS_HUB_VIEW_ONLY_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await submit();
      setReviewOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [submit, viewOnly]);

  return {
    reviewOpen,
    setReviewOpen,
    submitting,
    openReview,
    closeReview,
    confirmSubmit,
    viewOnly,
  };
}
