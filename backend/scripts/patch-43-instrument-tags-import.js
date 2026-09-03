/**
 * Import the 43-tag Instrument patch JSON into DigiLog (Sugar House).
 *
 * - 40 control-valve tags: replace instrument OEM schedule only
 * - 3 SCVS UPS tags: replace instrument specs + OEM + history
 *
 * Prerequisites:
 *   1. Deploy code with Sr.No. header fix in scripts/equipment_history_extract_lib.py
 *   2. Source workbook present (see extract script)
 *   3. py -3 DigiLog/scripts/patch_43_instrument_tags_extract.py
 *   4. SCVS hierarchy leaves exist (node scripts/add-scvs-ups-hierarchy.js) if needed
 *
 * Usage (from DigiLog/backend/, DATABASE_URL pointing at target DB):
 *   node scripts/patch-43-instrument-tags-import.js --dry-run
 *   node scripts/patch-43-instrument-tags-import.js
 */
require('../config/env');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');

const JSON_PATH = path.join(
  __dirname,
  '../backlog-data/mill data/migration files-24-08-26/patch-43-instrument-tags-extract.json',
);

const SECTION = 'instrument';
const META_SUBSECTIONS_LBL = '__subsections__';

function compact(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}
function letters(s) {
  return String(s || '').replace(/[^a-z0-9]+/g, '').toLowerCase();
}
function deviceKey(tag) {
  const t = String(tag || '').trim();
  const m = t.match(/\((.*)\)\s*$/);
  if (m) return letters(m[1]);
  if (t.includes('/')) return letters(t.split('/').pop());
  return letters(t);
}
function trim(v) {
  return String(v ?? '').trim();
}
function emptyToNull(v) {
  const s = trim(v);
  return s === '' ? null : s;
}
function clip(v, maxLen) {
  const s = emptyToNull(v);
  if (s == null) return null;
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}
function normalizeIvMark(value) {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const u = s.toUpperCase();
  if (['X', '-', 'NO', 'N', 'NA', 'N/A'].includes(u)) return null;
  if (['YES', 'Y', '√', '✓', '✔', '1', 'TRUE', 'OK'].includes(u) || s === '√' || s === '✓') {
    return 'X';
  }
  return s.length <= 1 ? s : 'X';
}
function toMysqlDate(value) {
  const s = trim(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

const SCHEDULE_IV_KEYS = ['iv_W', 'iv_M', 'iv_Q', 'iv_H', 'iv_Y', 'iv_T', 'iv_3Y'];

function mergeScheduleRows(rows) {
  const merged = [];
  const indexByKey = new Map();
  for (const row of rows) {
    const key = `${row.no}::${String(row.comp || '').trim().toLowerCase()}`;
    if (indexByKey.has(key)) {
      const existing = merged[indexByKey.get(key)];
      const act = trim(row.act);
      if (act) existing.act = existing.act ? `${existing.act} || ${act}` : act;
      for (const ivKey of SCHEDULE_IV_KEYS) {
        if (row[ivKey] && !existing[ivKey]) existing[ivKey] = row[ivKey];
      }
      continue;
    }
    indexByKey.set(key, merged.length);
    merged.push({ ...row });
  }
  return merged;
}

function pickEquip(equips, userTag, sourceTag) {
  const keys = [sourceTag, userTag].filter(Boolean);
  for (const e of equips) {
    for (const f of [e.equip_no, e.tag_name]) {
      if (f && keys.some((k) => compact(f) === compact(k))) return e;
    }
  }
  const want = deviceKey(userTag);
  const hits = [];
  for (const e of equips) {
    for (const f of [e.equip_no, e.tag_name]) {
      if (f && deviceKey(f) === want && want.length >= 4) {
        hits.push(e);
        break;
      }
    }
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1 && sourceTag) {
    const srcLetters = letters(sourceTag);
    const preferred = hits.find((e) =>
      [e.equip_no, e.tag_name].some((f) => f && letters(f) === srcLetters),
    );
    if (preferred) return preferred;
  }
  return hits[0] || null;
}

function buildSchedule(card, primarySub) {
  return mergeScheduleRows(
    (card.schedule || []).map((s, index) => ({
      section: SECTION,
      sub_section: primarySub,
      equipment_refs: [{ section: SECTION, sub_section: primarySub }],
      no: Number(s.sr) || index + 1,
      comp: trim(s.comp),
      act: trim(s.act),
      iv_W: normalizeIvMark(s.Weekly) || normalizeIvMark(s.Daily),
      iv_M: normalizeIvMark(s.Monthly),
      iv_Q: normalizeIvMark(s.Quarterly),
      iv_H: normalizeIvMark(s['Half - Yearly']),
      iv_Y: normalizeIvMark(s.Yearly),
      iv_T: normalizeIvMark(s['2 - Years']),
      iv_3Y: normalizeIvMark(s['3 - Years']) || normalizeIvMark(s['4 - Years']),
    })).filter((r) => r.act || r.comp || r.iv_W || r.iv_M || r.iv_Q || r.iv_H || r.iv_Y || r.iv_T || r.iv_3Y),
  );
}

function buildFull(card) {
  const lifeName = trim(card.name) || 'Others';
  const specs = [];
  const equipmentNames = [];
  for (const s of card.specs || []) {
    const lbl = emptyToNull(s.lbl);
    if (!lbl) continue;
    const sub = trim(s.sub_section) || lifeName;
    if (!equipmentNames.includes(sub)) equipmentNames.push(sub);
    specs.push({
      section: SECTION,
      sub_section: sub,
      lbl,
      val: String(s.val ?? ''),
    });
  }
  if (!equipmentNames.length) equipmentNames.push(lifeName);
  const primarySub = equipmentNames[0];
  specs.push({
    section: null,
    sub_section: null,
    lbl: META_SUBSECTIONS_LBL,
    val: JSON.stringify({
      mechanical: [],
      civil: [],
      instrument: equipmentNames,
      electrical: [],
    }),
  });

  const history = (card.history || []).map((h) => {
    const seasonRaw = trim(h.season);
    const seasonNorm = seasonRaw.toUpperCase();
    if (
      seasonNorm.includes('NAME OF EQUIPMENT')
      || seasonNorm.includes('DATE OF COMMISSIONING')
      || seasonNorm.includes('EQUIPMENT NO')
      || seasonNorm.includes('LOCATION')
      || seasonNorm.includes('EQUIPMENT LIFE HISTORY')
      || seasonNorm.includes('EQUIPMENT SPECIFICATION')
    ) return null;
    const year = emptyToNull(h.year);
    const date_start = toMysqlDate(h.date_start);
    const date_finish = toMysqlDate(h.date_finish);
    const obs = emptyToNull(h.obs);
    const act = emptyToNull(h.act);
    if (!seasonRaw && !year && !date_start && !date_finish && !obs && !act) return null;
    return {
      section: SECTION,
      sub_section: primarySub,
      equipment_refs: [{ section: SECTION, sub_section: primarySub }],
      season: clip(seasonRaw, 20),
      year: clip(year, 50),
      date_start,
      date_finish,
      obs,
      act,
      cost: clip(h.cost, 50),
      svc: clip(h.svc, 20),
      provider: null,
      resp: emptyToNull(h.resp),
      rem: emptyToNull(h.rem),
    };
  }).filter(Boolean);

  return {
    location: emptyToNull(card.location),
    commissioned: emptyToNull(card.commissioned),
    primarySub,
    specs,
    schedule: buildSchedule(card, primarySub),
    history,
  };
}

function buildOemOnly(card) {
  const primarySub = trim(card.name).replace(/[-–—\s]+$/g, '') || 'Control valve';
  return {
    primarySub,
    schedule: buildSchedule(card, primarySub),
  };
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Extract JSON not found: ${JSON_PATH}\nRun: py -3 DigiLog/scripts/patch_43_instrument_tags_extract.py`);
  }
  const cards = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  if (!Array.isArray(cards) || cards.length !== 43) {
    throw new Error(`Expected 43 cards in extract JSON, got ${cards?.length}`);
  }

  const conn = await pool.getConnection();
  try {
    const [equips] = await conn.query(
      'SELECT id, equip_no, tag_name, name FROM shn_equipment',
    );

    let ok = 0;
    const missing = [];

    for (const card of cards) {
      const eq = pickEquip(equips, card.user_tag, card.source_tag);
      if (!eq) {
        missing.push(card.user_tag);
        console.log(`NO_EQUIP\t${card.user_tag}`);
        continue;
      }

      if (card.mode === 'full') {
        const payload = buildFull(card);
        console.log(
          `${dryRun ? 'DRY' : 'OK'}\tFULL\t${card.user_tag}\tequip=${eq.id}\t`
          + `specs=${payload.specs.length - 1}\tsched=${payload.schedule.length}\thist=${payload.history.length}`,
        );
        if (!dryRun) {
          await conn.beginTransaction();
          try {
            await conn.execute(
              `UPDATE shn_equipment
               SET location = COALESCE(?, location),
                   commissioned = COALESCE(?, commissioned)
               WHERE id = ?`,
              [payload.location, payload.commissioned, eq.id],
            );
            await conn.execute('DELETE FROM shn_history WHERE equip_id = ?', [eq.id]);
            await conn.execute('DELETE FROM shn_oem_schedule WHERE equip_id = ?', [eq.id]);
            await conn.execute('DELETE FROM shn_specs WHERE equip_id = ?', [eq.id]);
            for (let i = 0; i < payload.specs.length; i += 1) {
              const s = payload.specs[i];
              await conn.execute(
                `INSERT INTO shn_specs (equip_id, section, sub_section, lbl, val, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [eq.id, s.section, s.sub_section, s.lbl, s.val ?? '', i],
              );
            }
            for (const row of payload.schedule) {
              await conn.execute(
                `INSERT INTO shn_oem_schedule
                   (equip_id, section, sub_section, equipment_refs, no, comp, act,
                    iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  eq.id, row.section, row.sub_section, JSON.stringify(row.equipment_refs),
                  row.no, row.comp, row.act,
                  row.iv_W, row.iv_M, row.iv_Q, row.iv_H, row.iv_Y, row.iv_T, row.iv_3Y,
                ],
              );
            }
            for (const row of payload.history) {
              await conn.execute(
                `INSERT INTO shn_history
                   (equip_id, section, sub_section, equipment_refs, season, year,
                    date_start, date_finish, obs, act, cost, svc, provider, resp, rem)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  eq.id, row.section, row.sub_section, JSON.stringify(row.equipment_refs),
                  row.season, row.year, row.date_start, row.date_finish,
                  row.obs, row.act, row.cost, row.svc, row.provider, row.resp, row.rem,
                ],
              );
            }
            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          }
        }
      } else {
        const payload = buildOemOnly(card);
        console.log(
          `${dryRun ? 'DRY' : 'OK'}\tOEM\t${card.user_tag}\tequip=${eq.id}\t`
          + `sched=${payload.schedule.length}\tsub=${payload.primarySub}`,
        );
        if (!dryRun) {
          await conn.beginTransaction();
          try {
            await conn.execute(
              `DELETE FROM shn_oem_schedule
               WHERE equip_id = ? AND LOWER(IFNULL(section,'')) = 'instrument'`,
              [eq.id],
            );
            for (const row of payload.schedule) {
              await conn.execute(
                `INSERT INTO shn_oem_schedule
                   (equip_id, section, sub_section, equipment_refs, no, comp, act,
                    iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  eq.id, row.section, row.sub_section, JSON.stringify(row.equipment_refs),
                  row.no, row.comp, row.act,
                  row.iv_W, row.iv_M, row.iv_Q, row.iv_H, row.iv_Y, row.iv_T, row.iv_3Y,
                ],
              );
            }
            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          }
        }
      }
      ok += 1;
    }

    console.log('\nSUMMARY', { dryRun, ok, missingEquip: missing.length, missing });
    if (missing.length) process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
