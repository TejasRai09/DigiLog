const VIEW_ONLY_MESSAGE = 'View-only access. You can see this data but cannot change it.';

function isFormsHubViewOnly(user) {
  if (!user) return false;
  if (user.role !== 'employee') return false;
  return Boolean(user.formsHubViewOnly);
}

function rejectIfFormsHubViewOnly(req, res, next) {
  if (isFormsHubViewOnly(req.user)) {
    return res.status(403).json({ message: VIEW_ONLY_MESSAGE });
  }
  return next();
}

module.exports = {
  VIEW_ONLY_MESSAGE,
  isFormsHubViewOnly,
  rejectIfFormsHubViewOnly,
};
