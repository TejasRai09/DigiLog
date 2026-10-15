const fs = require('fs');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  PLANTS,
  getNotesHodAccess,
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
    const tree = await getEquipmentTree(req.query.plant);
    res.json(tree);
  } catch (err) {
    handleKnown(res, err, 'maintenanceNotes.equipmentTree:');
  }
};

const getPlants = async (_req, res) => {
  res.json({
    plants: Object.values(PLANTS).map((p) => ({ key: p.key, label: p.label })),
  });
};

const getAccess = async (req, res) => {
  try {
    const access = await getNotesHodAccess(req.user.id);
    res.json(access);
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
    res.download(abs, doc.displayName || 'document');
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
