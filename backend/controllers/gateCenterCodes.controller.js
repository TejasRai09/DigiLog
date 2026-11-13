const {
  listGateCodes,
  addGateCode,
  deleteGateCode,
} = require('../services/managementDashboard/gateCenterCodes');

exports.getGateCenterCodes = async (req, res) => {
  try {
    const rows = await listGateCodes();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching gate center codes:', err);
    res.status(500).json({ error: 'Failed to load gate center codes' });
  }
};

exports.createGateCenterCode = async (req, res) => {
  try {
    const row = await addGateCode(req.body?.code);
    res.json({ ...row, message: 'Gate center code added.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Error adding gate center code:', err);
    res.status(500).json({ error: 'Failed to add gate center code' });
  }
};

exports.deleteGateCenterCode = async (req, res) => {
  try {
    await deleteGateCode(req.params.id);
    res.json({ message: 'Gate center code removed.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Error deleting gate center code:', err);
    res.status(500).json({ error: 'Failed to remove gate center code' });
  }
};
