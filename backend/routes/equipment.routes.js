const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/equipment.controller');

router.get('/',                     authenticate, ctrl.listEquipment);
router.get('/:id',                  authenticate, ctrl.getEquipment);
router.put('/:id',                  authenticate, ctrl.updateEquipment);
router.put('/:id/image/:type',      authenticate, ctrl.uploadImage);
router.delete('/:id/image/:type',   authenticate, ctrl.deleteImage);
router.put('/:id/specs',            authenticate, ctrl.updateSpecs);
router.put('/:id/schedule',         authenticate, ctrl.updateSchedule);
router.get('/:id/history',          authenticate, ctrl.getHistory);
router.post('/:id/history',         authenticate, ctrl.addHistory);
router.put('/:id/history/:hid',     authenticate, ctrl.updateHistory);
router.delete('/:id/history/:hid',  authenticate, ctrl.deleteHistory);

module.exports = router;
