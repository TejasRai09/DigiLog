const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const {
  submitForm,
  submitBatch,
  getRecords,
  getFormMeta,
  getRecord,
  updateRecord,
  deleteRecord,
} = require('../controllers/form.controller');

router.get('/:formKey/records/:recordKey', authenticate, getRecord);
router.put('/:formKey/records/:recordKey', authenticate, rejectIfFormsHubViewOnly, updateRecord);
router.delete('/:formKey/records/:recordKey', authenticate, rejectIfFormsHubViewOnly, deleteRecord);
router.get('/:formKey/records',           authenticate, getRecords);
router.get('/:formKey',                   authenticate, getFormMeta);
router.post('/:formKey/batch',            authenticate, rejectIfFormsHubViewOnly, submitBatch);
router.post('/:formKey',                  authenticate, rejectIfFormsHubViewOnly, submitForm);

module.exports = router;
