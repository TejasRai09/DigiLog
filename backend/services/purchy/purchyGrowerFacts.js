/**
 * Pre-aggregated per-grower 2025 facts (Indent / Supply / Dishonour), keyed by
 * (village_code, grower_code). Rebuilt after every Purchy grower import so BI
 * queries join one row per grower instead of re-grouping the raw fact tables.
 *
 * Measure definitions match purchyPbiFacts (PBI _Measures.tmdl): supply and
 * dishonour reach a grower through Indent purchy no.
 */
const { pool } = require('../../config/mysql');

const FACTS_TABLE = 'purchy_grower_facts_2025';

const FACTS_DDL = (table) => `
  CREATE TABLE IF NOT EXISTS \`${table}\` (
    \`village_code\` INT NOT NULL,
    \`grower_code\` INT NOT NULL,
    \`indent_count\` INT NOT NULL DEFAULT 0,
    \`indent_qty\` BIGINT NOT NULL DEFAULT 0,
    \`supply_count\` INT NOT NULL DEFAULT 0,
    \`supply_qty\` DECIMAL(20,4) NOT NULL DEFAULT 0,
    \`supply_netwt\` DOUBLE NOT NULL DEFAULT 0,
    \`dishonour_count\` INT NOT NULL DEFAULT 0,
    \`dishonour_qty\` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`village_code\`, \`grower_code\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;

/**
 * PBI calculated column Grower_Purchywise_Supply[purchasemodeqty]:
 * VALUE(LEFT(purchasemodename, SEARCH(" ", purchasemodename) - 1))
 */
function purchaseModeQtySql(alias = 's') {
  return `CASE
    WHEN ${alias}.purchasemodename IS NOT NULL
     AND LOCATE(' ', ${alias}.purchasemodename) > 0
     AND SUBSTRING_INDEX(${alias}.purchasemodename, ' ', 1) REGEXP '^[0-9]+([.][0-9]+)?$'
    THEN CAST(SUBSTRING_INDEX(${alias}.purchasemodename, ' ', 1) AS DECIMAL(18,4))
    ELSE NULL
  END`;
}

const FILL_SQL = (table) => `
  INSERT INTO \`${table}\` (
    village_code, grower_code,
    indent_count, indent_qty,
    supply_count, supply_qty, supply_netwt,
    dishonour_count, dishonour_qty
  )
  SELECT
    ind.villagecode, ind.growercode,
    ind.indent_count, ind.indent_qty,
    IFNULL(sup.supply_count, 0), IFNULL(sup.supply_qty, 0), IFNULL(sup.supply_netwt, 0),
    IFNULL(dh.dishonour_count, 0), IFNULL(dh.dishonour_qty, 0)
  FROM (
    SELECT villagecode, growercode,
      COUNT(*) AS indent_count,
      IFNULL(SUM(supllymodeqty), 0) AS indent_qty
    FROM purchy_indent
    WHERE villagecode IS NOT NULL AND growercode IS NOT NULL
    GROUP BY villagecode, growercode
  ) ind
  LEFT JOIN (
    SELECT i.villagecode, i.growercode,
      COUNT(DISTINCT s.id) AS supply_count,
      IFNULL(SUM(${purchaseModeQtySql('s')}), 0) AS supply_qty,
      IFNULL(SUM(s.netwt), 0) AS supply_netwt
    FROM purchy_supply s
    INNER JOIN purchy_indent i ON s.societypurchy_no = i.societypurchy_no
    GROUP BY i.villagecode, i.growercode
  ) sup ON sup.villagecode = ind.villagecode AND sup.growercode = ind.growercode
  LEFT JOIN (
    SELECT i.villagecode, i.growercode,
      COUNT(*) AS dishonour_count,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i ON d.society_purchy_no = i.societypurchy_no
    GROUP BY i.villagecode, i.growercode
  ) dh ON dh.villagecode = ind.villagecode AND dh.growercode = ind.growercode`;

let readyPromise = null;
let rebuildPromise = null;

/**
 * Build into a staging table and swap atomically, so readers never see a
 * half-filled facts table.
 * @returns {Promise<{ growers: number, ms: number }>}
 */
function rebuildGrowerFacts() {
  if (rebuildPromise) return rebuildPromise;
  rebuildPromise = (async () => {
    const started = Date.now();
    const staging = `${FACTS_TABLE}_new`;
    const old = `${FACTS_TABLE}_old`;
    const conn = await pool.getConnection();
    try {
      await conn.query(FACTS_DDL(FACTS_TABLE));
      await conn.query(`DROP TABLE IF EXISTS \`${staging}\`, \`${old}\``);
      await conn.query(FACTS_DDL(staging));
      const [result] = await conn.query(FILL_SQL(staging));
      await conn.query(
        `RENAME TABLE \`${FACTS_TABLE}\` TO \`${old}\`, \`${staging}\` TO \`${FACTS_TABLE}\``,
      );
      await conn.query(`DROP TABLE IF EXISTS \`${old}\``);
      readyPromise = Promise.resolve();
      return { growers: result.affectedRows, ms: Date.now() - started };
    } finally {
      conn.release();
    }
  })().finally(() => {
    rebuildPromise = null;
  });
  return rebuildPromise;
}

/**
 * Create and fill the facts table on first use when it is missing or empty
 * but indent data exists (e.g. migration applied without running the backfill).
 */
function ensureGrowerFacts() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    await pool.query(FACTS_DDL(FACTS_TABLE));
    const [[facts]] = await pool.query(`SELECT EXISTS(SELECT 1 FROM \`${FACTS_TABLE}\`) AS has_rows`);
    if (Number(facts.has_rows)) return;
    const [[indent]] = await pool.query('SELECT EXISTS(SELECT 1 FROM purchy_indent) AS has_rows');
    if (!Number(indent.has_rows)) return;
    await rebuildGrowerFacts();
  })().catch((err) => {
    readyPromise = null;
    throw err;
  });
  return readyPromise;
}

module.exports = {
  FACTS_TABLE,
  purchaseModeQtySql,
  rebuildGrowerFacts,
  ensureGrowerFacts,
};
