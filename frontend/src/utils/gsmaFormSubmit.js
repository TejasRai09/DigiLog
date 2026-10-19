import toast from 'react-hot-toast';

/** Wraps API submit for useGsmaFormReview — shows toast and rethrows on failure. */
export async function gsmaSubmitRequest(request, successMessage) {
  try {
    const result = await request();
    const pending = Boolean(result?.data?.pendingApproval);
    toast.success(
      pending
        ? (result?.data?.message || 'Sent for approval')
        : (successMessage || 'Form submitted successfully.'),
    );
  } catch (err) {
    toast.error(err.response?.data?.message || 'Submission failed.');
    throw err;
  }
}
