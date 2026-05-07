const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  sendMailToUser,
  sendMailBulk,
  getMappings,
  upsertMapping,
  deleteMapping,
  getAllAppsWithForms,
} = require('../controllers/admin.controller');

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

router.get('/users',                    getUsers);
router.post('/users',                   createUser);
router.put('/users/:id',                updateUser);
router.delete('/users/:id',             deleteUser);
router.post('/users/:id/send-mail',     sendMailToUser);
router.post('/users/send-mail-bulk',    sendMailBulk);

router.get('/mappings',      getMappings);
router.post('/mappings',     upsertMapping);
router.delete('/mappings/:id', deleteMapping);

router.get('/apps-all',      getAllAppsWithForms);

module.exports = router;
