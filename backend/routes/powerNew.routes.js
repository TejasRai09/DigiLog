const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/powerNew.controller');
const hier = require('../controllers/ppnHierarchy.controller');

router.get('/lookup',               authenticate, ctrl.lookupEquipment);
router.get('/hierarchy',            authenticate, hier.getTree);
router.get('/hierarchy/path/:nodeId', authenticate, hier.getPath);
router.post('/hierarchy',           authenticate, hier.createNode);
router.put('/hierarchy/:nodeId',    authenticate, hier.updateNode);
router.delete('/hierarchy/:nodeId', authenticate, hier.deleteNode);
router.patch('/hierarchy/:nodeId/link', authenticate, hier.linkNode);
router.patch('/hierarchy/:nodeId/sync-name', authenticate, hier.syncNodeName);
router.get('/',                     authenticate, ctrl.listEquipment);
router.post('/',                    authenticate, ctrl.createEquipment);
router.get('/:id',                  authenticate, ctrl.getEquipment);
router.put('/:id',                  authenticate, ctrl.updateEquipment);
router.put('/:id/image/:type',      authenticate, ctrl.uploadImage);
router.delete('/:id/image/:type',   authenticate, ctrl.deleteImage);
router.put('/:id/specs',            authenticate, ctrl.updateSpecs);
router.put('/:id/schedule',         authenticate, ctrl.updateSchedule);
router.delete('/:id/history-sub-group', authenticate, ctrl.deleteSubGroupHistory);
router.put('/:id/history-sub-group/rename', authenticate, ctrl.renameSubGroupHistory);
router.get('/:id/history',          authenticate, ctrl.getHistory);
router.post('/:id/history',         authenticate, ctrl.addHistory);
router.put('/:id/history/:hid',     authenticate, ctrl.updateHistory);
router.delete('/:id/history/:hid',  authenticate, ctrl.deleteHistory);

module.exports = router;
