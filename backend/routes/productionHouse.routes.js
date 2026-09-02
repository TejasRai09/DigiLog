const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/productionHouse.controller');

router.get('/houses', authenticate, ctrl.listHouses);
router.get('/', authenticate, ctrl.listEquipment);
router.get('/:id', authenticate, ctrl.getEquipment);
router.put('/:id', authenticate, ctrl.updateEquipment);
router.put('/:id/specs', authenticate, ctrl.updateSpecs);
router.get('/:id/history', authenticate, ctrl.getHistory);
router.post('/:id/history', authenticate, ctrl.addHistory);
router.put('/:id/history/:hid', authenticate, ctrl.updateHistory);
router.delete('/:id/history/:hid', authenticate, ctrl.deleteHistory);

module.exports = router;
