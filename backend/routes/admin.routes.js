const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  assignManager,
  sendMailToUser,
  sendMailBulk,
  getMappings,
  upsertMapping,
  deleteMapping,
  getAllAppsWithForms,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/admin.controller');
const {
  getAdminBiSettings,
  updateAdminBiSettings,
} = require('../controllers/biSettings.controller');
const {
  getAdminDataUploadAccess,
  upsertAdminDataUploadAccess,
} = require('../controllers/dataUpload.controller');

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

router.get('/users',                    getUsers);
router.post('/users',                   createUser);
router.put('/users/:id',                updateUser);
router.delete('/users/:id',             deleteUser);
router.put('/users/:id/manager',        assignManager);
router.post('/users/:id/send-mail',     sendMailToUser);
router.post('/users/send-mail-bulk',    sendMailBulk);

router.get('/mappings',      getMappings);
router.post('/mappings',     upsertMapping);
router.delete('/mappings/:id', deleteMapping);

router.get('/apps-all',      getAllAppsWithForms);

router.get('/bi-settings',  getAdminBiSettings);
router.put('/bi-settings',  updateAdminBiSettings);

router.get('/data-upload-access',  getAdminDataUploadAccess);
router.put('/data-upload-access',  upsertAdminDataUploadAccess);

const {
  getAllSeasons,
  createSeason,
  updateSeason,
  deleteSeason,
} = require('../controllers/seasonMapping.controller');
const { listAuditLogs } = require('../controllers/auditLog.controller');
const {
  listActivityLogs,
  listSessions,
  listAuditFilterOptions,
} = require('../controllers/activityAdmin.controller');

router.get('/categories',           getCategories);
router.post('/categories',          createCategory);
router.put('/categories/:id',       updateCategory);
router.delete('/categories/:id',    deleteCategory);

router.get('/season-mapping',           getAllSeasons);
router.post('/season-mapping',          createSeason);
router.put('/season-mapping/:id',       updateSeason);
router.delete('/season-mapping/:id',    deleteSeason);

router.get('/audit-logs', listAuditLogs);
router.get('/activity-logs', listActivityLogs);
router.get('/sessions', listSessions);
router.get('/audit-filter-options', listAuditFilterOptions);

const {
  getMaintenanceHistoryApprovalSettings,
  putMaintenanceHistoryApprovalSettings,
} = require('../controllers/maintenanceHistoryApprovalSettings.controller');

router.get('/maintenance-history-approval-settings', getMaintenanceHistoryApprovalSettings);
router.put('/maintenance-history-approval-settings', putMaintenanceHistoryApprovalSettings);

module.exports = router;
