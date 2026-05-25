import { useCallback, useState } from 'react';

/**
 * Opens a review modal on submit; runs `submit` only after user confirms.
 */
export function useGsmaFormReview({ validate, submit }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openReview = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (validate?.() === false) return;
      setReviewOpen(true);
    },
    [validate],
  );

  const closeReview = useCallback(() => {
    if (!submitting) setReviewOpen(false);
  }, [submitting]);

  const confirmSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await submit();
      setReviewOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [submit]);

  return {
    reviewOpen,
    setReviewOpen,
    submitting,
    openReview,
    closeReview,
    confirmSubmit,
  };
}
