const { pool } = require('../config/mysql');

exports.getAllSeasons = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM season_mapping ORDER BY start_date DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching season mappings:', err);
    res.status(500).json({ error: 'Failed to fetch season mappings' });
  }
};

exports.createSeason = async (req, res) => {
  const { season_label, start_date, end_date } = req.body;
  if (!season_label || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    const [result] = await pool.query(
      'INSERT INTO season_mapping (season_label, start_date, end_date) VALUES (?, ?, ?)',
      [season_label, start_date, end_date]
    );
    res.json({ id: result.insertId, season_label, start_date, end_date, message: 'Created successfully' });
  } catch (err) {
    console.error('Error creating season mapping:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Season label already exists' });
    }
    res.status(500).json({ error: 'Failed to create season mapping' });
  }
};

exports.updateSeason = async (req, res) => {
  const { id } = req.params;
  const { season_label, start_date, end_date } = req.body;
  
  try {
    await pool.query(
      'UPDATE season_mapping SET season_label = ?, start_date = ?, end_date = ? WHERE id = ?',
      [season_label, start_date, end_date, id]
    );
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('Error updating season mapping:', err);
    res.status(500).json({ error: 'Failed to update season mapping' });
  }
};

exports.deleteSeason = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM season_mapping WHERE id = ?', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting season mapping:', err);
    res.status(500).json({ error: 'Failed to delete season mapping' });
  }
};
