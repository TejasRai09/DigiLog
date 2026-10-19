const fs = require('fs');
const path = require('path');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  getNotesHodAccess,
  plantsForUser,
  lockedPlantForUser,
  canUseMaintenanceNotesRegister,
  listNotes,
  getNote,
  getEquipmentTree,
  createNote,
  updateNote,
  addNoteDocument,
  getNoteDocumentFile,
  submitNote,
  decideNote,
} = require('../services/maintenanceNotes.service');

function handleKnown(res, err, label) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  return sendServerError(res, label, err, MSG.SERVER);
}

const equipmentTree = async (req, res) => {
  try {
    const tree = await getEquipmentTree(req.query.plant, req.user);
    res.json(tree);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.equipmentTree:');
  }
};

const getPlants = async (req, res) => {
  try {
    res.json(plantsForUser(req.user));
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.getPlants:');
  }
};

const getAccess = async (req, res) => {
  try {
    const access = await getNotesHodAccess(req.user);
    const lockedPlant = lockedPlantForUser(req.user);
    res.json({
      ...access,
      lockedPlant,
      canUseRegister: canUseMaintenanceNotesRegister(req.user),
    });
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.getAccess:');
  }
};

const list = async (req, res) => {
  try {
    const data = await listNotes(req.user, req.query);
    res.json(data);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.list:');
  }
};

const listHod = async (req, res) => {
  try {
    const data = await listNotes(req.user, req.query, { hodOnly: true });
    res.json(data);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.listHod:');
  }
};

const getOne = async (req, res) => {
  try {
    const note = await getNote(req.user, req.params.id);
    res.json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.getOne:');
  }
};

const create = async (req, res) => {
  try {
    const note = await createNote(req.user, req.body || {});
    res.status(201).json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.create:');
  }
};

const update = async (req, res) => {
  try {
    const note = await updateNote(req.user, req.params.id, req.body || {});
    res.json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.update:');
  }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF or Word file.' });
    const document = await addNoteDocument(
      req.user,
      req.params.id,
      req.file,
      req.body?.displayName,
    );
    res.status(201).json({ document });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    handleKnown(res, err, 'maintenanceNotes.uploadDocument:');
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { abs, doc } = await getNoteDocumentFile(req.user, req.params.id, req.params.fileName);
    const disposition = String(req.query.disposition || 'inline').trim() === 'attachment'
      ? 'attachment'
      : 'inline';
    const safeName = path.basename(doc.displayName || req.params.fileName || 'document');
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return fs.createReadStream(abs).pipe(res);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.downloadDocument:');
  }
};

const submit = async (req, res) => {
  try {
    const note = await submitNote(req.user, req.params.id, req.body || {});
    res.json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.submit:');
  }
};

const approve = async (req, res) => {
  try {
    const note = await decideNote(req.user, req.params.id, {
      decision: 'approved',
      remarks: req.body?.remarks,
    });
    res.json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.approve:');
  }
};

const reject = async (req, res) => {
  try {
    const note = await decideNote(req.user, req.params.id, {
      decision: 'rejected',
      remarks: req.body?.remarks,
    });
    res.json(note);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.reject:');
  }
};

module.exports = {
  getPlants,
  equipmentTree,
  getAccess,
  list,
  listHod,
  getOne,
  create,
  update,
  uploadDocument,
  downloadDocument,
  submit,
  approve,
  reject,
};
