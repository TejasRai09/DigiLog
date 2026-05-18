import toast from 'react-hot-toast';

/** Wraps API submit for useGsmaFormReview — shows toast and rethrows on failure. */
export async function gsmaSubmitRequest(request, successMessage) {
  try {
    await request();
    if (successMessage) toast.success(successMessage);
  } catch (err) {
    toast.error(err.response?.data?.message || 'Submission failed.');
    throw err;
  }
}
