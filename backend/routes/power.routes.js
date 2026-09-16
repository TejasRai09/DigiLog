const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const ctrl = require('../controllers/power.controller');

router.get('/lookup',               authenticate, ctrl.lookupEquipment);
router.get('/',                     authenticate, ctrl.listEquipment);
router.post('/',                    authenticate, rejectIfFormsHubViewOnly, ctrl.createEquipment);
router.get('/:id',                  authenticate, ctrl.getEquipment);
router.put('/:id',                  authenticate, rejectIfFormsHubViewOnly, ctrl.updateEquipment);
router.put('/:id/image/:type',      authenticate, rejectIfFormsHubViewOnly, ctrl.uploadImage);
router.delete('/:id/image/:type',   authenticate, rejectIfFormsHubViewOnly, ctrl.deleteImage);
router.put('/:id/specs',            authenticate, rejectIfFormsHubViewOnly, ctrl.updateSpecs);
router.put('/:id/schedule',         authenticate, rejectIfFormsHubViewOnly, ctrl.updateSchedule);
router.get('/:id/history',          authenticate, ctrl.getHistory);
router.post('/:id/history',         authenticate, rejectIfFormsHubViewOnly, ctrl.addHistory);
router.put('/:id/history/:hid',     authenticate, rejectIfFormsHubViewOnly, ctrl.updateHistory);
router.delete('/:id/history/:hid',  authenticate, rejectIfFormsHubViewOnly, ctrl.deleteHistory);

module.exports = router;
