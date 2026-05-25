const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { submitForm, getRecords, getFormMeta } = require('../controllers/form.controller');

router.get('/:formKey/records',           authenticate, getRecords);
router.get('/:formKey',                   authenticate, getFormMeta);
router.post('/:formKey',                  authenticate, submitForm);

module.exports = router;
