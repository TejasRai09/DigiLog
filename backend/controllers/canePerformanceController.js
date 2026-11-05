const { syncLiveCaneData, getLastSyncInfo } = require('../services/caneLiveSyncService');
const { getMysqlCanePerformanceData } = require('./canePerformanceMysql');
const { pool: mysqlPool } = require('../config/mysql');
const { streamCaneSeasonWorkbook } = require('../utils/canePerformanceExport');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function isMssqlLiveEnabled() {
  try {
    const [rows] = await mysqlPool.query(
      'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
      ['cane_performance_data_source']
    );
    return rows[0]?.setting_value === 'live';
  } catch (err) {
    console.warn('[canePerformance] Failed to check cane_performance_data_source:', err.message);
    return false;
  }
}

const getGate1Data = async (req, res) => {
  try {
    const { from, to, mode, center, challan, tab, pyFrom, pyTo } = req.query;

    const useMssqlLive = await isMssqlLiveEnabled();

    if (useMssqlLive) {
      // Non-blocking background sync (Stale-While-Revalidate):
      // Trigger background sync if cooldown has elapsed, without stalling this API response.
      syncLiveCaneData({ force: false, full: false }).catch((syncErr) => {
        console.warn('[canePerformance] Background sync failed:', syncErr.message);
      });
    }

    const data = await getMysqlCanePerformanceData(from, to, { mode, center, challan, tab, pyFrom, pyTo });
    res.json({
      ...data,
      dataSource: useMssqlLive ? 'live' : 'db',
      syncInfo: useMssqlLive ? getLastSyncInfo() : null,
    });
  } catch (err) {
    console.error('Error fetching Cane Performance data:', err);
    res.status(500).json({ error: err.message });
  }
};

const getBrixSamplingData = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from).toISOString().split('T')[0] : '2000-01-01';
    const toDate = to ? new Date(to).toISOString().split('T')[0] : '2100-01-01';

    const yardQuery = `
      SELECT * FROM brix_yard_sampling 
      WHERE Date >= ? AND Date <= ?
    `;
    const [yardRows] = await mysqlPool.execute(yardQuery, [fromDate, toDate]);

    const fieldQuery = `
      SELECT * FROM brix_field_sampling 
      WHERE Date >= ? AND Date <= ?
    `;
    const [fieldRows] = await mysqlPool.execute(fieldQuery, [fromDate, toDate]);

    res.json({ yard: yardRows, field: fieldRows });
  } catch (error) {
    console.error('Error fetching Brix Sampling Data:', error);
    res.status(500).json({ error: 'Failed to fetch Brix Sampling data' });
  }
};


const exportSeasonWorkbook = async (req, res) => {
  const { scope, tab, from, to } = req.query;
  if (!ISO_DATE.test(String(from || '')) || !ISO_DATE.test(String(to || ''))) {
    return res.status(400).json({ error: 'from and to must be YYYY-MM-DD.' });
  }
  try {
    const useMssqlLive = await isMssqlLiveEnabled();
    if (useMssqlLive) {
      const sync = await syncLiveCaneData({ force: false });
      if (sync?.success === false) {
        console.warn('[canePerformance] Export continuing on last synced data:', sync.error);
      }
    }
    await streamCaneSeasonWorkbook(res, {
      scope: scope === 'all' ? 'all' : 'tab',
      tabId: tab || 'procurement',
      from,
      to,
      dataSource: useMssqlLive ? 'Live airacanedb (MSSQL sync)' : 'Database (MySQL)',
    });
  } catch (err) {
    console.error('Error exporting Cane Performance workbook:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message });
    } else {
      res.destroy(err);
    }
  }
};

const triggerLiveSync = async (req, res) => {
  try {
    const full = req.body?.full === true || req.query?.full === 'true';
    const result = await syncLiveCaneData({ force: true, full });
    res.json({
      success: result.success !== false,
      result,
      syncInfo: getLastSyncInfo(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  triggerLiveSync,
  getGate1Data,
  exportSeasonWorkbook,
  getGate2Data: async (req, res) => res.json({}),
  getCenterPurchaseData: async (req, res) => res.json({}),
  getMillPerformanceData: async (req, res) => res.json({}),
  getBrixSamplingData
};
