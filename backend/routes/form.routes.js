const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { submitForm, getRecords } = require('../controllers/form.controller');

router.post('/:formKey',         authenticate, submitForm);
router.get('/:formKey/records',  authenticate, getRecords);

module.exports = router;
