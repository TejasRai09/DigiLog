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
} = require('../controllers/admin.controller');
const {
  getAdminHomepageCards,
  upsertUserHomepageCards,
} = require('../controllers/homepageCards.controller');
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

router.get('/homepage-cards',  getAdminHomepageCards);
router.put('/homepage-cards',  upsertUserHomepageCards);

router.get('/bi-settings',  getAdminBiSettings);
router.put('/bi-settings',  updateAdminBiSettings);

router.get('/data-upload-access',  getAdminDataUploadAccess);
router.put('/data-upload-access',  upsertAdminDataUploadAccess);

module.exports = router;
