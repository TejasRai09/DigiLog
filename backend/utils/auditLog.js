const SENSITIVE_KEY_RE = /password|passwd|token|secret|authorization|cookie|avatar|photo|plate|img_|image|data_url|base64/i;
const META_LBL_RE = /^__.*__$/;
const MAX_BODY_CHARS = 100000;

const ACTION_TYPES = {
  POST: 'Create',
  PUT: 'Update',
  PATCH: 'Update',
  DELETE: 'Delete',
};

/** API prefix → breadcrumb hub label (matches frontend navigation language). */
const MODULE_LABELS = {
  'power-new': 'Power Plant Equipment',
  power: 'Power Plant Equipment (Legacy)',
  'sugar-new': 'Sugar House Equipment',
  equipment: 'Mill House Equipment',
  forms: 'Forms',
  admin: 'Admin Config',
  auth: 'Account',
  bi: 'BI Control Tower',
  'data-upload': 'Data Upload',
  'homepage-cards': 'Homepage Cards',
  apps: 'Apps',
};

const ADMIN_SEGMENT_LABELS = {
  users: 'Employees',
  mappings: 'Employee Mappings',
  categories: 'Employee Categories',
  'season-mapping': 'Season Mapping',
  'bi-settings': 'BI Dashboards',
  'data-upload-access': 'Data Upload Access',
  'apps-all': 'Apps',
  'audit-logs': 'Audit Log',
};

const RESOURCE_SEGMENT_LABELS = {
  specs: 'Specs',
  schedule: 'OEM Schedule',
  history: 'Life History',
  'history-sub-group': 'Life History Sub-group',
  rename: 'Rename',
  link: 'Link Equipment',
  'sync-name': 'Sync Name',
  image: 'Image',
  hierarchy: 'Hierarchy',
  records: 'Record',
  batch: 'Batch Submit',
  manager: 'Assign Manager',
  'send-mail': 'Send Mail',
  'send-mail-bulk': 'Send Mail (Bulk)',
  avatar: 'Avatar',
};

function isDataUrlOrHugeString(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:')) return true;
  return value.length > 500;
}

function titleCase(str) {
  return String(str || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeKey(key) {
  if (!key) return '';
  if (key === 'lbl') return 'Field';
  if (key === 'val') return 'Value';
  if (key === 'sub_section' || key === 'subSection') return 'Equipment / sub-section';
  if (key === 'sort_order' || key === 'sortOrder') return 'Order';
  if (key === 'equip_no' || key === 'equipNo') return 'Equipment No.';
  if (key === 'form_key' || key === 'formKey') return 'Form';
  return titleCase(key);
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 6) return '[Truncated]';

  if (typeof value === 'string') {
    if (isDataUrlOrHugeString(value)) return '[Image / long text omitted]';
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    const maxItems = 40;
    const items = value.slice(0, maxItems).map((v) => sanitizeValue(v, depth + 1));
    if (value.length > maxItems) items.push(`[+${value.length - maxItems} more]`);
    return items;
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[Redacted]';
        continue;
      }
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }

  return String(value);
}

function tryParseJson(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const DISCIPLINE_KEYS = ['mechanical', 'civil', 'instrument', 'electrical', 'instrument2'];

function disciplineDisplayName(key) {
  const k = String(key || '').trim().toLowerCase();
  if (k === 'instrument2') return 'Instrument II';
  return titleCase(k);
}

function parseSubsectionsObject(val) {
  const parsed = typeof val === 'string' ? tryParseJson(val) : val;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed;
}

/**
 * Diff before/after __subsections__ so audit shows only added/removed names,
 * not the full current list.
 */
function formatSubsectionsDiff(beforeVal, afterVal) {
  const before = parseSubsectionsObject(beforeVal);
  const after = parseSubsectionsObject(afterVal);
  const lines = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const dept of keys) {
    const prev = new Set(
      (Array.isArray(before[dept]) ? before[dept] : []).map((x) => String(x).trim()).filter(Boolean),
    );
    const next = new Set(
      (Array.isArray(after[dept]) ? after[dept] : []).map((x) => String(x).trim()).filter(Boolean),
    );
    const added = [...next].filter((x) => !prev.has(x));
    const removed = [...prev].filter((x) => !next.has(x));
    if (!added.length && !removed.length) continue;

    const label = disciplineDisplayName(dept);
    if (added.length) {
      lines.push({
        field: `Added under ${label} discipline`,
        value: added.join(', '),
        discipline: label,
        change: 'added',
      });
    }
    if (removed.length) {
      lines.push({
        field: `Removed under ${label} discipline`,
        value: removed.join(', '),
        discipline: label,
        change: 'removed',
      });
    }
  }

  return lines.length ? lines : null;
}

function formatSubsectionsMeta(val, beforeVal = null) {
  if (beforeVal != null) {
    const diff = formatSubsectionsDiff(beforeVal, val);
    if (diff) return diff;
    // No list membership change — omit full dump
    return null;
  }

  const parsed = parseSubsectionsObject(val);
  const lines = [];
  for (const [dept, list] of Object.entries(parsed)) {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!items.length) continue;
    const label = disciplineDisplayName(dept);
    lines.push({
      field: `Equipment under ${label} discipline`,
      value: items.join(', '),
      discipline: label,
    });
  }
  return lines.length ? lines : null;
}

/** Collect discipline names touched in a specs save. */
function inferSpecDisciplines(readableBody, rawBody) {
  const found = new Set();

  const fields = Array.isArray(readableBody?.fields) ? readableBody.fields : [];
  for (const f of fields) {
    if (f?.discipline) {
      found.add(String(f.discipline));
      continue;
    }
    const label = String(f?.field || '');
    const m = label.match(/^(?:Added|Removed|Equipment) under (.+) discipline$/i)
      || label.match(/^(.+) equipment list$/i);
    if (m) found.add(m[1]);
    if (f?.under) {
      const first = String(f.under).split(' › ')[0]?.trim();
      if (first && DISCIPLINE_KEYS.includes(first.toLowerCase())) {
        found.add(disciplineDisplayName(first));
      }
    }
  }

  if (Array.isArray(rawBody?.specs)) {
    const hasChangeRows = fields.some((f) => f?.change === 'added' || f?.change === 'removed');
    if (!hasChangeRows) {
      for (const row of rawBody.specs) {
        if (!row) continue;
        if (row.lbl === '__subsections__') {
          const parsed = typeof row.val === 'string' ? tryParseJson(row.val) : row.val;
          if (parsed && typeof parsed === 'object') {
            for (const [dept, list] of Object.entries(parsed)) {
              if (Array.isArray(list) && list.length) found.add(disciplineDisplayName(dept));
            }
          }
        }
        const section = row.section != null ? String(row.section).trim() : '';
        if (section && DISCIPLINE_KEYS.includes(section.toLowerCase())) {
          found.add(disciplineDisplayName(section));
        }
      }
    }
  }

  return [...found];
}

function underDisciplineClause(disciplines) {
  if (!disciplines?.length) return '';
  if (disciplines.length === 1) return ` under ${disciplines[0]} discipline`;
  if (disciplines.length === 2) {
    return ` under ${disciplines[0]} and ${disciplines[1]} disciplines`;
  }
  const last = disciplines[disciplines.length - 1];
  return ` under ${disciplines.slice(0, -1).join(', ')}, and ${last} disciplines`;
}

/**
 * Convert API payloads (especially equipment specs) into field/value rows
 * similar to what users see on the frontend forms.
 * @param {object} [opts]
 * @param {string|object|null} [opts.beforeSubsections] prior __subsections__ for diffing
 */
function toReadableAuditPayload(body, opts = {}) {
  if (body == null) return null;
  if (typeof body !== 'object') {
    return { fields: [{ field: 'Value', value: String(body) }] };
  }

  const fields = [];
  const beforeSubsections = opts.beforeSubsections ?? null;

  // ── Specs (Specifications section) ─────────────────────────
  if (Array.isArray(body.specs)) {
    for (const row of body.specs) {
      if (!row || typeof row !== 'object') continue;
      const lbl = String(row.lbl || '').trim();
      if (!lbl) continue;

      if (lbl === '__subsections__') {
        // What changed (add/remove) — shown first
        if (beforeSubsections != null) {
          const diff = formatSubsectionsDiff(beforeSubsections, row.val);
          if (diff) {
            for (const line of diff) {
              fields.push({ ...line, group: 'Changes' });
            }
          }
        }
        // Full lists as submitted in this save
        const full = formatSubsectionsMeta(row.val, null);
        if (full) {
          for (const line of full) {
            fields.push({ ...line, group: 'Equipment lists (full input)' });
          }
        }
        continue;
      }

      if (META_LBL_RE.test(lbl) || lbl === '__subgroup_meta__') {
        fields.push({
          field: 'Sub-group layout metadata',
          value: '[Updated — binary layout omitted]',
          group: 'System',
        });
        continue;
      }

      const section = row.section != null && String(row.section).trim() ? String(row.section).trim() : '';
      const sub = (row.sub_section || row.subSection);
      const subSection = sub != null && String(sub).trim() ? String(sub).trim() : '';
      const scope = [section, subSection].filter(Boolean);
      const group = scope.length
        ? `${disciplineDisplayName(section || scope[0])}${subSection ? ` › ${subSection}` : ''}`
        : 'Other specification fields';

      let value = row.val;
      if (typeof value === 'string' && isDataUrlOrHugeString(value)) {
        value = '[Image / long text omitted]';
      } else if (value != null && typeof value === 'object') {
        value = JSON.stringify(sanitizeValue(value));
      } else if (value == null) {
        value = '';
      }

      fields.push({
        field: lbl,
        value: String(value),
        group,
        ...(scope.length ? { under: scope.join(' › ') } : {}),
      });
    }

    return {
      what_changed: 'Specifications',
      sections_note: 'All submitted specification inputs are listed below.',
      fields,
    };
  }

  // ── OEM Schedule section ───────────────────────────────────
  if (Array.isArray(body.schedule)) {
    body.schedule.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      const equip = row.equipment || row.sub_section || row.subSection || row.name || '';
      const section = row.section ? disciplineDisplayName(row.section) : '';
      const group = [
        'OEM Schedule',
        section,
        equip,
        `Row ${index + 1}`,
      ].filter(Boolean).join(' › ');

      const entries = Object.entries(row);
      if (!entries.length) {
        fields.push({ field: '(empty row)', value: '—', group });
        return;
      }
      for (const [key, val] of entries) {
        if (val == null || val === '') {
          fields.push({ field: humanizeKey(key), value: '—', group });
          continue;
        }
        if (typeof val === 'string' && isDataUrlOrHugeString(val)) {
          fields.push({ field: humanizeKey(key), value: '[Image / long text omitted]', group });
          continue;
        }
        if (typeof val === 'object') {
          fields.push({ field: humanizeKey(key), value: JSON.stringify(sanitizeValue(val)), group });
          continue;
        }
        fields.push({ field: humanizeKey(key), value: String(val), group });
      }
    });
    return {
      what_changed: 'OEM Schedule',
      sections_note: 'All submitted schedule row inputs are listed below.',
      fields,
    };
  }

  // ── Maintenance History section ────────────────────────────
  const looksLikeHistory = body.equipment_refs != null
    || body.obs != null
    || body.act != null
    || body.maintenance_type != null
    || body.date_start != null
    || body.img_before != null
    || body.img_after != null;

  if (looksLikeHistory) {
    const HISTORY_LABELS = {
      season: 'Season',
      year: 'Year',
      date_start: 'Date start',
      date_finish: 'Date finish',
      obs: 'Observation',
      act: 'Action taken',
      cost: 'Repair cost',
      svc: 'Service',
      maintenance_type: 'Maintenance type',
      provider: 'Provider',
      resp: 'Responsible',
      rem: 'Remarks',
      section: 'Discipline',
      sub_section: 'Equipment / sub-section',
      subSection: 'Equipment / sub-section',
      img_before: 'Photos before',
      img_after: 'Photos after',
      equipment_refs: 'Equipment mappings',
    };

    const group = 'Maintenance History';
    for (const [key, val] of Object.entries(body)) {
      const label = HISTORY_LABELS[key] || humanizeKey(key);
      if (key === 'equipment_refs' && Array.isArray(val)) {
        if (!val.length) {
          fields.push({ field: label, value: '—', group });
          continue;
        }
        val.forEach((ref, i) => {
          const sec = ref?.section || '';
          const sub = ref?.sub_section || ref?.subSection || '';
          fields.push({
            field: `${label} ${i + 1}`,
            value: [sec && disciplineDisplayName(sec), sub].filter(Boolean).join(' › ') || JSON.stringify(ref),
            group,
          });
        });
        continue;
      }
      if (SENSITIVE_KEY_RE.test(key) || key === 'img_before' || key === 'img_after') {
        if (val == null || val === '') {
          fields.push({ field: label, value: '—', group });
        } else if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('data:'))) {
          let count = 1;
          try {
            if (val.startsWith('[')) count = JSON.parse(val).length;
          } catch { /* ignore */ }
          fields.push({ field: label, value: `${count} photo(s) attached`, group });
        } else {
          fields.push({ field: label, value: '[Image omitted]', group });
        }
        continue;
      }
      if (val == null || val === '') {
        fields.push({ field: label, value: '—', group });
        continue;
      }
      if (typeof val === 'object') {
        fields.push({ field: label, value: JSON.stringify(sanitizeValue(val)), group });
        continue;
      }
      fields.push({ field: label, value: String(val), group });
    }
    return {
      what_changed: 'Maintenance History',
      sections_note: 'All submitted maintenance history inputs are listed below.',
      fields,
    };
  }

  // Generic object → every key/value (skip only empty optional noise)
  for (const [key, val] of Object.entries(body)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      fields.push({ field: humanizeKey(key), value: '[Redacted]', group: 'Details' });
      continue;
    }
    if (val == null || val === '') {
      fields.push({ field: humanizeKey(key), value: '—', group: 'Details' });
      continue;
    }
    if (Array.isArray(val)) {
      if (!val.length) {
        fields.push({ field: humanizeKey(key), value: '—', group: 'Details' });
        continue;
      }
      if (val.every((x) => x != null && typeof x !== 'object')) {
        fields.push({ field: humanizeKey(key), value: val.join(', '), group: 'Details' });
      } else {
        val.forEach((item, i) => {
          fields.push({
            field: `${humanizeKey(key)} ${i + 1}`,
            value: typeof item === 'object' ? JSON.stringify(sanitizeValue(item)) : String(item),
            group: 'Details',
          });
        });
      }
      continue;
    }
    if (typeof val === 'object') {
      for (const [k2, v2] of Object.entries(val)) {
        fields.push({
          field: humanizeKey(k2),
          value: v2 == null || v2 === '' ? '—' : String(typeof v2 === 'object' ? JSON.stringify(sanitizeValue(v2)) : v2),
          group: humanizeKey(key),
        });
      }
      continue;
    }
    if (typeof val === 'string' && isDataUrlOrHugeString(val)) {
      fields.push({ field: humanizeKey(key), value: '[Image / long text omitted]', group: 'Details' });
      continue;
    }
    fields.push({ field: humanizeKey(key), value: String(val), group: 'Details' });
  }

  return { fields };
}

function sanitizeRequestBody(body, opts = {}) {
  if (body == null) return null;
  try {
    const readable = toReadableAuditPayload(body, opts);
    let json = JSON.stringify(readable);
    if (json.length > MAX_BODY_CHARS) {
      json = `${json.slice(0, MAX_BODY_CHARS)}…`;
    }
    return json;
  } catch {
    try {
      const sanitized = sanitizeValue(body);
      let json = JSON.stringify(sanitized);
      if (json.length > MAX_BODY_CHARS) json = `${json.slice(0, MAX_BODY_CHARS)}…`;
      return json;
    } catch {
      return null;
    }
  }
}

function actionTypeFromMethod(method) {
  const m = String(method || '').toUpperCase();
  return ACTION_TYPES[m] || m || '—';
}

function parseApiPath(rawPath) {
  const pathOnly = String(rawPath || '').split('?')[0];
  const parts = pathOnly.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  return { pathOnly, parts };
}

function segmentLabel(seg) {
  if (!seg) return '';
  if (RESOURCE_SEGMENT_LABELS[seg]) return RESOURCE_SEGMENT_LABELS[seg];
  if (ADMIN_SEGMENT_LABELS[seg]) return ADMIN_SEGMENT_LABELS[seg];
  if (/^\d+$/.test(seg)) return null;
  return titleCase(seg);
}

/**
 * Sync breadcrumb from API path (IDs left as placeholders until resolved).
 */
function buildDisplayPath(rawPath, opts = {}) {
  const { parts } = parseApiPath(rawPath);
  if (!parts.length) return rawPath || '—';

  const names = opts.names || {};
  const crumbs = [];
  const moduleKey = parts[0];
  crumbs.push(MODULE_LABELS[moduleKey] || titleCase(moduleKey));

  for (let i = 1; i < parts.length; i += 1) {
    const seg = parts[i];
    if (/^\d+$/.test(seg)) {
      const name = names[`${moduleKey}:${seg}`] || names[`hierarchy:${seg}`] || names[seg];
      crumbs.push(name || `#${seg}`);
      continue;
    }
    if (moduleKey === 'admin' && ADMIN_SEGMENT_LABELS[seg]) {
      crumbs.push(ADMIN_SEGMENT_LABELS[seg]);
      continue;
    }
    if (moduleKey === 'forms' && i === 1) {
      crumbs.push(names[`form:${seg}`] || titleCase(seg.replace(/_/g, ' ')));
      continue;
    }
    const label = segmentLabel(seg);
    if (label) crumbs.push(label);
  }

  return crumbs.filter((c, i) => c && c !== crumbs[i - 1]).join(' › ');
}

function buildActionSummary(method, path, displayPath) {
  const action = actionTypeFromMethod(method);
  const loc = displayPath || buildDisplayPath(path);
  return `${action}: ${loc}`.slice(0, 255);
}

function fieldMapFromReadable(readableBody) {
  const map = {};
  const fields = Array.isArray(readableBody?.fields) ? readableBody.fields : [];
  for (const f of fields) {
    if (!f?.field) continue;
    map[String(f.field).toLowerCase()] = f.value;
  }
  return map;
}

function pickBodyValue(rawBody, readableBody, ...keys) {
  if (rawBody && typeof rawBody === 'object') {
    for (const key of keys) {
      if (rawBody[key] != null && String(rawBody[key]).trim() !== '') {
        return String(rawBody[key]).trim();
      }
    }
  }
  const map = fieldMapFromReadable(readableBody);
  const aliases = {
    name: ['name', 'name of equipment'],
    node_type: ['node type', 'node_type'],
    parent_id: ['parent id', 'parent_id'],
    equip_no: ['equipment no.', 'equip no', 'equip_no', 'tag / equipment no.'],
    location: ['location', 'hist_location'],
    lookup_name: ['lookup name', 'lookup_name'],
  };
  for (const key of keys) {
    const list = aliases[key] || [key, humanizeKey(key).toLowerCase()];
    for (const a of list) {
      if (map[a] != null && String(map[a]).trim() !== '') return String(map[a]).trim();
    }
  }
  return null;
}

function quoteName(name) {
  if (!name) return null;
  return `"${String(name).replace(/"/g, '')}"`;
}

function hierarchyItemKind(moduleKey, nodeType, hierarchyPath) {
  const isEquip = String(nodeType || '').toLowerCase() === 'equipment';
  const depth = Array.isArray(hierarchyPath)
    ? hierarchyPath.length
    : (hierarchyPath ? String(hierarchyPath).split(' › ').filter(Boolean).length : 0);

  if (moduleKey === 'sugar-new') {
    if (isEquip || depth >= 4) return 'sub equipment';
    if (depth === 1) return 'section';
    if (depth === 2) return 'location';
    if (depth === 3) return 'main equipment';
    return 'hierarchy item';
  }

  // Power plant: root → category → subcategory → equipment
  if (isEquip || depth >= 3) return 'equipment';
  if (depth === 1) return 'category';
  if (depth === 2) return 'subcategory';
  return 'hierarchy item';
}

function underClause(parentLabel, displayPath) {
  if (parentLabel) return ` under ${quoteName(parentLabel) || parentLabel}`;
  if (displayPath) {
    const bits = String(displayPath).split(' › ').filter(Boolean);
    // drop hub label if present
    const leaf = bits.length > 1 ? bits[bits.length - 1] : null;
    if (leaf && !/^#\d+$/.test(leaf) && leaf !== 'Hierarchy') {
      return ` under ${quoteName(leaf)}`;
    }
  }
  return '';
}

function equipmentLabel(resourceName, displayPath) {
  if (resourceName) return quoteName(resourceName);
  if (displayPath) {
    const bits = String(displayPath).split(' › ').filter(Boolean);
    for (let i = bits.length - 1; i >= 0; i -= 1) {
      const b = bits[i];
      if (['Specs', 'OEM Schedule', 'Life History', 'Hierarchy', 'Image'].includes(b)) continue;
      if (/^#\d+$/.test(b)) continue;
      return quoteName(b);
    }
  }
  return null;
}

function summarizeNamedFields(readableBody, preferredLabels, limit = 5) {
  const fields = Array.isArray(readableBody?.fields) ? readableBody.fields : [];
  const skip = new Set([
    'parent id', 'node type', 'order', 'sort order', 'id',
    'password', 'avatar', 'img before', 'img after',
  ]);
  const preferred = preferredLabels
    ? fields.filter((f) => preferredLabels.some((p) => String(f.field).toLowerCase().includes(p)))
    : fields;
  const names = preferred
    .map((f) => String(f.field || '').trim())
    .filter((n) => {
      if (!n || skip.has(n.toLowerCase()) || /^__/.test(n)) return false;
      // Discipline list / add-remove rows are handled in the description sentence
      if (/equipment under .+ discipline/i.test(n)) return false;
      if (/^(added|removed) under .+ discipline$/i.test(n)) return false;
      if (/equipment list$/i.test(n)) return false;
      return true;
    });
  if (!names.length) return '';
  const shown = names.slice(0, limit);
  const more = names.length > limit ? ` (+${names.length - limit} more)` : '';
  return `${shown.join(', ')}${more}`;
}

/**
 * UI-style sentence describing what changed (matches Power/Sugar card language).
 */
function buildChangeDescription({
  method,
  path,
  actionType,
  screen,
  resourceName,
  resourceType,
  displayPath,
  readableBody,
  rawBody,
  parentLabel,
  hierarchyPath,
}) {
  const { parts } = parseApiPath(path || '');
  const moduleKey = parts[0] || '';
  const m = String(method || '').toUpperCase();
  const action = actionType || actionTypeFromMethod(method);
  const equip = equipmentLabel(resourceName, displayPath);
  const body = rawBody && typeof rawBody === 'object' ? rawBody : null;

  // ── Hierarchy (Power / Sugar) ──────────────────────────────
  if (parts[1] === 'hierarchy') {
    const name = pickBodyValue(body, readableBody, 'name') || resourceName;
    const nodeType = pickBodyValue(body, readableBody, 'node_type') || null;
    const kind = hierarchyItemKind(moduleKey, nodeType, hierarchyPath);
    const under = underClause(parentLabel, displayPath);

    if (parts.includes('link')) {
      return `Linked equipment to hierarchy node${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
    }
    if (parts.includes('sync-name')) {
      return `Synced hierarchy name${name ? ` to ${quoteName(name)}` : ''}${equip ? ` for ${equip}` : ''}`.slice(0, 255);
    }
    if (m === 'POST') {
      return `Added ${kind}${name ? ` ${quoteName(name)}` : ''}${under}`.slice(0, 255);
    }
    if (m === 'DELETE') {
      return `Deleted ${kind}${name ? ` ${quoteName(name)}` : under || ''}`.slice(0, 255);
    }
    return `Updated ${kind}${name ? ` ${quoteName(name)}` : ''}${under}`.slice(0, 255);
  }

  // ── Specs ─────────────────────────────────────────────────
  if (parts.includes('specs')) {
    const fields = Array.isArray(readableBody?.fields) ? readableBody.fields : [];
    const added = fields.filter((f) => f?.change === 'added' || /^Added under /i.test(String(f?.field || '')));
    const removed = fields.filter((f) => f?.change === 'removed' || /^Removed under /i.test(String(f?.field || '')));

    if (added.length === 1 && !removed.length) {
      const row = added[0];
      const disc = row.discipline || 'discipline';
      const names = String(row.value || '').trim();
      if (names) {
        return `Added ${quoteName(names)} under ${disc} discipline${equip ? ` on ${equip}` : ''}`.slice(0, 255);
      }
    }
    if (removed.length === 1 && !added.length) {
      const row = removed[0];
      const disc = row.discipline || 'discipline';
      const names = String(row.value || '').trim();
      if (names) {
        return `Removed ${quoteName(names)} under ${disc} discipline${equip ? ` on ${equip}` : ''}`.slice(0, 255);
      }
    }
    if (added.length || removed.length) {
      const bits = [];
      for (const row of added) {
        bits.push(`added ${row.value} (${row.discipline || 'discipline'})`);
      }
      for (const row of removed) {
        bits.push(`removed ${row.value} (${row.discipline || 'discipline'})`);
      }
      return `Updated specifications${equip ? ` for ${equip}` : ''} — ${bits.join('; ')}`.slice(0, 255);
    }

    const disciplines = inferSpecDisciplines(readableBody, body);
    const fieldSummary = summarizeNamedFields(readableBody);
    const base = `Updated specifications${equip ? ` for ${equip}` : ''}${underDisciplineClause(disciplines)}`;
    if (fieldSummary) return `${base} — ${fieldSummary}`.slice(0, 255);
    return base.slice(0, 255);
  }

  // ── OEM Schedule ──────────────────────────────────────────
  if (parts.includes('schedule')) {
    return `Saved OEM schedule${equip ? ` for ${equip}` : ''}`.slice(0, 255);
  }

  // ── Maintenance history sub-group ─────────────────────────
  if (parts.includes('history-sub-group')) {
    const section = pickBodyValue(body, readableBody, 'section')
      || (typeof body?.section === 'string' ? body.section : null);
    const oldSub = body?.old_sub_section || pickBodyValue(body, readableBody, 'old_sub_section');
    const newSub = body?.new_sub_section || pickBodyValue(body, readableBody, 'new_sub_section');
    const sub = body?.sub_section || pickBodyValue(body, readableBody, 'sub_section');
    if (parts.includes('rename') || m === 'PUT') {
      if (oldSub && newSub) {
        return `Renamed equipment sub-group ${quoteName(oldSub)} to ${quoteName(newSub)}${equip ? ` on ${equip}` : ''}`.slice(0, 255);
      }
      return `Renamed equipment sub-group${equip ? ` on ${equip}` : ''}`.slice(0, 255);
    }
    if (m === 'DELETE') {
      return `Deleted equipment sub-group${sub ? ` ${quoteName(sub)}` : ''}${section ? ` (${section})` : ''}${equip ? ` on ${equip}` : ''}`.slice(0, 255);
    }
  }

  // ── Maintenance history records ───────────────────────────
  if (parts.includes('history')) {
    const sub = body?.sub_section || pickBodyValue(body, readableBody, 'sub_section', 'Equipment / sub-section');
    const section = body?.section || pickBodyValue(body, readableBody, 'section');
    const where = [section, sub].filter(Boolean).join(' › ');
    if (m === 'POST') {
      return `Added maintenance history record${equip ? ` on ${equip}` : ''}${where ? ` (${where})` : ''}`.slice(0, 255);
    }
    if (m === 'DELETE') {
      return `Deleted maintenance history record${equip ? ` on ${equip}` : ''}`.slice(0, 255);
    }
    return `Updated maintenance history record${equip ? ` on ${equip}` : ''}${where ? ` (${where})` : ''}`.slice(0, 255);
  }

  // ── Images (Life History gallery / equipment photos) ──────
  if (parts.includes('image')) {
    const type = parts[parts.indexOf('image') + 1] || 'photo';
    const label = titleCase(type);
    if (m === 'DELETE') {
      return `Removed ${label} photo${equip ? ` from ${equip}` : ''}`.slice(0, 255);
    }
    return `Updated ${label} photo${equip ? ` on ${equip}` : ''}`.slice(0, 255);
  }

  // ── Equipment root update (Life History Card details) ─────
  if (['power-new', 'power', 'sugar-new', 'equipment'].includes(moduleKey)
    && parts.length === 2
    && /^\d+$/.test(parts[1])
    && (m === 'PUT' || m === 'PATCH')) {
    const detailFields = summarizeNamedFields(readableBody, [
      'tag', 'equip', 'name', 'location', 'commission', 'drive',
    ]);
    const base = `Updated Life History Card details${equip ? ` for ${equip}` : ''}`;
    if (detailFields) return `${base} — ${detailFields}`.slice(0, 255);
    return base.slice(0, 255);
  }

  if (['power-new', 'power', 'sugar-new', 'equipment'].includes(moduleKey)
    && parts.length === 1
    && m === 'POST') {
    const name = pickBodyValue(body, readableBody, 'name');
    return `Created equipment${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
  }

  // ── Admin / forms / generic (readable, not raw keys) ──────
  if (moduleKey === 'admin') {
    const target = screen || resourceType || 'admin setting';
    if (parts.includes('users')) {
      const name = pickBodyValue(body, readableBody, 'name') || resourceName;
      if (m === 'POST') return `Created employee${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
      if (m === 'DELETE') return `Deleted employee${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
      if (parts.includes('manager')) return `Assigned manager${name ? ` for ${quoteName(name)}` : ''}`.slice(0, 255);
      if (parts.includes('send-mail')) return `Sent activation email${name ? ` to ${quoteName(name)}` : ''}`.slice(0, 255);
      return `Updated employee${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
    }
    if (parts.includes('categories')) {
      const name = pickBodyValue(body, readableBody, 'name') || resourceName;
      if (m === 'POST') return `Added employee category${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
      if (m === 'DELETE') return `Deleted employee category${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
      return `Updated employee category${name ? ` ${quoteName(name)}` : ''}`.slice(0, 255);
    }
    if (parts.includes('season-mapping')) {
      const label = pickBodyValue(body, readableBody, 'season_label') || resourceName;
      if (m === 'POST') return `Added season mapping${label ? ` ${quoteName(label)}` : ''}`.slice(0, 255);
      if (m === 'DELETE') return `Deleted season mapping${label ? ` ${quoteName(label)}` : ''}`.slice(0, 255);
      return `Updated season mapping${label ? ` ${quoteName(label)}` : ''}`.slice(0, 255);
    }
    const verb = action === 'Create' ? 'Created' : action === 'Delete' ? 'Deleted' : 'Updated';
    return `${verb} ${target}`.slice(0, 255);
  }

  if (moduleKey === 'forms') {
    const formName = resourceName || (parts[1] ? titleCase(parts[1].replace(/_/g, ' ')) : 'form');
    if (parts.includes('batch')) return `Submitted batch rows on form ${quoteName(formName)}`.slice(0, 255);
    if (parts.includes('records') && m === 'DELETE') return `Deleted form record on ${quoteName(formName)}`.slice(0, 255);
    if (parts.includes('records') && (m === 'PUT' || m === 'PATCH')) return `Updated form record on ${quoteName(formName)}`.slice(0, 255);
    return `Submitted form ${quoteName(formName)}`.slice(0, 255);
  }

  // Fallback — never dump technical field-name lists
  const verb = action === 'Create' ? 'Created' : action === 'Delete' ? 'Deleted' : 'Updated';
  if (screen && equip) return `${verb} ${screen.toLowerCase()} for ${equip}`.slice(0, 255);
  if (screen) return `${verb} ${screen.toLowerCase()}`.slice(0, 255);
  if (equip) return `${verb} ${equip}`.slice(0, 255);
  if (displayPath) {
    const bits = String(displayPath).split(' › ').filter(Boolean);
    return `${verb} ${bits[bits.length - 1] || displayPath}`.slice(0, 255);
  }
  return `${verb} record`.slice(0, 255);
}

function shouldSkipAudit(method, path) {
  const m = String(method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return true;

  const p = String(path || '').split('?')[0];
  if (p === '/api/health') return true;
  if (p.startsWith('/api/admin/audit-logs')) return true;
  // Internal hierarchy bookkeeping — not a user-facing edit to log
  if (/^\/api\/(power-new|sugar-new)\/hierarchy\/\d+\/link$/.test(p)) return true;
  if (/^\/api\/(power-new|sugar-new)\/hierarchy\/\d+\/sync-name$/.test(p)) return true;
  return false;
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim().slice(0, 64);
  return (req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64) || null;
}

/**
 * Resolve human names for IDs referenced in an API path (best-effort).
 */
async function resolvePathNames(pool, rawPath, rawBody = null) {
  const { parts } = parseApiPath(rawPath);
  const names = {};
  if (!parts.length || !pool) return names;

  const moduleKey = parts[0];
  const hierTable = moduleKey === 'sugar-new' ? 'shn_hierarchy_node' : 'ppn_hierarchy_node';
  const isHierarchyRoute = parts[1] === 'hierarchy';
  const id = parts.find((p) => /^\d+$/.test(p));

  try {
    if (isHierarchyRoute) {
      const nodeId = id || null;
      const parentId = rawBody?.parent_id != null ? String(rawBody.parent_id) : null;

      if (nodeId) {
        const [[node]] = await pool.query(
          `SELECT id, name, parent_id, node_type FROM \`${hierTable}\` WHERE id = ? LIMIT 1`,
          [nodeId],
        );
        if (node?.name) {
          names[`${moduleKey}:${nodeId}`] = node.name;
          names[`hierarchy:${nodeId}`] = node.name;
          names.__node_name__ = node.name;
          names.__node_type__ = node.node_type;
        }
        if (node?.id) {
          const labels = await walkHierarchyLabels(pool, node.id, hierTable);
          if (labels.length) names.__hierarchy__ = labels.join(' › ');
          if (labels.length >= 2) names.__parent_label__ = labels[labels.length - 2];
        }
      }

      if (parentId) {
        const [[parent]] = await pool.query(
          `SELECT id, name FROM \`${hierTable}\` WHERE id = ? LIMIT 1`,
          [parentId],
        );
        if (parent?.name) {
          names.__parent_label__ = parent.name;
          const labels = await walkHierarchyLabels(pool, parent.id, hierTable);
          if (labels.length) names.__hierarchy__ = labels.join(' › ');
        }
      }
      return names;
    }

    if (moduleKey === 'power-new' && id) {
      const [[eq]] = await pool.query('SELECT id, name FROM ppn_equipment WHERE id = ? LIMIT 1', [id]);
      if (eq?.name) names[`${moduleKey}:${id}`] = eq.name;

      const [[node]] = await pool.query(
        'SELECT id, name FROM ppn_hierarchy_node WHERE ppn_equip_id = ? LIMIT 1',
        [id],
      );
      if (node?.id) {
        const labels = await walkHierarchyLabels(pool, node.id, 'ppn_hierarchy_node');
        if (labels.length) names.__hierarchy__ = labels.join(' › ');
      }
    } else if (moduleKey === 'power' && id) {
      const [[eq]] = await pool.query('SELECT id, name FROM pp_equipment WHERE id = ? LIMIT 1', [id]);
      if (eq?.name) names[`${moduleKey}:${id}`] = eq.name;
    } else if (moduleKey === 'sugar-new' && id) {
      const [[eq]] = await pool.query('SELECT id, name FROM shn_equipment WHERE id = ? LIMIT 1', [id]);
      if (eq?.name) names[`${moduleKey}:${id}`] = eq.name;

      const [[node]] = await pool.query(
        'SELECT id, name FROM shn_hierarchy_node WHERE shn_equip_id = ? LIMIT 1',
        [id],
      );
      if (node?.id) {
        const labels = await walkHierarchyLabels(pool, node.id, 'shn_hierarchy_node');
        if (labels.length) names.__hierarchy__ = labels.join(' › ');
      }
    } else if (moduleKey === 'equipment' && id) {
      const [[eq]] = await pool.query('SELECT id, name FROM mh_equipment WHERE id = ? LIMIT 1', [id]);
      if (eq?.name) names[`${moduleKey}:${id}`] = eq.name;
    } else if (moduleKey === 'admin' && parts[1] === 'users' && id) {
      const [[u]] = await pool.query('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [id]);
      if (u) names[`${moduleKey}:${id}`] = u.name || u.email || `#${id}`;
    } else if (moduleKey === 'forms' && parts[1]) {
      const formKey = parts[1];
      const [[f]] = await pool.query(
        'SELECT form_key, name FROM forms WHERE form_key = ? LIMIT 1',
        [formKey],
      );
      if (f?.name) names[`form:${formKey}`] = f.name;
    }
  } catch (err) {
    console.error('[auditLog.resolvePathNames]', err.message);
  }

  return names;
}

async function walkHierarchyLabels(pool, nodeId, table = 'ppn_hierarchy_node') {
  const labels = [];
  let currentId = nodeId;
  const guard = new Set();
  while (currentId && !guard.has(currentId)) {
    guard.add(currentId);
    const [[row]] = await pool.query(
      `SELECT id, parent_id, name FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [currentId],
    );
    if (!row) break;
    labels.unshift(row.name);
    currentId = row.parent_id;
  }
  return labels;
}

function displayPathFromNames(rawPath, names) {
  if (names.__hierarchy__) {
    const { parts } = parseApiPath(rawPath);
    const moduleKey = parts[0];
    const hub = MODULE_LABELS[moduleKey] || titleCase(moduleKey);
    const tail = [];
    let seenId = false;
    for (let i = 1; i < parts.length; i += 1) {
      if (/^\d+$/.test(parts[i])) {
        seenId = true;
        continue;
      }
      if (seenId) {
        const label = segmentLabel(parts[i]);
        if (label) tail.push(label);
      }
    }
    return [hub, names.__hierarchy__, ...tail].filter(Boolean).join(' › ');
  }
  return buildDisplayPath(rawPath, { names });
}

/**
 * Build display path with DB-resolved names when possible.
 */
async function buildEnrichedDisplayPath(pool, rawPath) {
  const names = await resolvePathNames(pool, rawPath);
  return displayPathFromNames(rawPath, names);
}

function inferResourceType(parts) {
  const moduleKey = parts[0];
  if (moduleKey === 'forms') return 'form';
  if (moduleKey === 'admin') {
    if (parts[1] === 'users') return 'user';
    if (parts[1] === 'categories') return 'category';
    if (parts[1] === 'season-mapping') return 'season';
    if (parts[1] === 'mappings') return 'mapping';
    return parts[1] || 'admin';
  }
  if (parts.includes('hierarchy')) return 'hierarchy_node';
  if (parts.includes('history')) return 'history';
  if (parts.includes('specs')) return 'specs';
  if (parts.includes('schedule')) return 'schedule';
  if (['power-new', 'power', 'sugar-new', 'equipment'].includes(moduleKey)) return 'equipment';
  return moduleKey || 'unknown';
}

function extractResourceMeta(rawPath, names = {}) {
  const { parts } = parseApiPath(rawPath);
  const moduleKey = parts[0] || '';
  const moduleLabel = MODULE_LABELS[moduleKey] || titleCase(moduleKey) || '—';
  const id = parts.find((p) => /^\d+$/.test(p)) || null;

  let resourceName = null;
  if (id && names[`${moduleKey}:${id}`]) resourceName = names[`${moduleKey}:${id}`];
  else if (moduleKey === 'forms' && parts[1] && names[`form:${parts[1]}`]) {
    resourceName = names[`form:${parts[1]}`];
  } else if (names.__hierarchy__) {
    const segs = String(names.__hierarchy__).split(' › ');
    resourceName = segs[segs.length - 1] || null;
  }

  let screen = null;
  const lastNamed = [...parts].reverse().find((p) => RESOURCE_SEGMENT_LABELS[p] || ADMIN_SEGMENT_LABELS[p]);
  if (lastNamed) {
    screen = RESOURCE_SEGMENT_LABELS[lastNamed] || ADMIN_SEGMENT_LABELS[lastNamed];
  } else if (moduleKey === 'forms') {
    screen = parts.includes('batch') ? 'Batch Submit' : (parts.includes('records') ? 'Record' : 'Form Submit');
  }

  return {
    module_key: moduleKey || null,
    module: moduleLabel,
    resource_type: inferResourceType(parts),
    resource_id: id || (moduleKey === 'forms' ? (parts[1] || null) : null),
    resource_name: resourceName,
    screen: screen || null,
  };
}

/**
 * Full enrichment for write + read paths.
 * @param {object} [rawBody] optional request body (helps resolve hierarchy parent)
 */
async function enrichAuditContext(pool, method, rawPath, statusCode, rawBody = null) {
  const names = await resolvePathNames(pool, rawPath, rawBody);
  const displayPath = displayPathFromNames(rawPath, names);
  const meta = extractResourceMeta(rawPath, names);
  const code = statusCode == null ? null : Number(statusCode);

  // Prefer body name for new hierarchy creates
  let resourceName = meta.resource_name;
  if (rawBody?.name && String(rawBody.name).trim()) {
    resourceName = String(rawBody.name).trim();
  } else if (names.__node_name__) {
    resourceName = names.__node_name__;
  }

  return {
    action_type: actionTypeFromMethod(method),
    display_path: displayPath,
    ...meta,
    resource_name: resourceName,
    parent_label: names.__parent_label__ || null,
    hierarchy_path: names.__hierarchy__ || null,
    success: code == null ? null : (code >= 200 && code < 400 ? 1 : 0),
  };
}

/**
 * Reformat a previously stored request_body JSON string for UI display.
 * Handles both new readable shape and legacy raw payloads.
 */
function parseStoredAuditBody(raw) {
  if (raw == null || raw === '') return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw.endsWith('…') ? raw.slice(0, -1) : raw);
    } catch {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { fields: [{ field: 'Raw', value: String(raw) }] };
      }
    }
  }

  if (parsed && Array.isArray(parsed.fields)) return parsed;
  if (parsed && typeof parsed === 'object') {
    return toReadableAuditPayload(parsed);
  }
  return { fields: [{ field: 'Value', value: String(parsed) }] };
}

const SPECS_TABLE_BY_MODULE = {
  'power-new': 'ppn_specs',
  power: 'pp_specs',
  'sugar-new': 'shn_specs',
  equipment: 'mh_specs',
};

/**
 * Load previous __subsections__ JSON before a specs PUT (for add/remove diff).
 */
async function captureSpecsBefore(pool, rawPath) {
  const { parts } = parseApiPath(rawPath);
  if (parts.length < 3 || parts[2] !== 'specs') return null;
  const moduleKey = parts[0];
  const equipId = parts[1];
  const table = SPECS_TABLE_BY_MODULE[moduleKey];
  if (!table || !/^\d+$/.test(String(equipId))) return null;

  try {
    const [rows] = await pool.query(
      `SELECT val FROM \`${table}\` WHERE equip_id = ? AND lbl = '__subsections__' LIMIT 1`,
      [equipId],
    );
    return rows[0]?.val ?? null;
  } catch (err) {
    console.error('[auditLog.captureSpecsBefore]', err.message);
    return null;
  }
}

module.exports = {
  sanitizeRequestBody,
  buildActionSummary,
  buildChangeDescription,
  buildDisplayPath,
  buildEnrichedDisplayPath,
  enrichAuditContext,
  extractResourceMeta,
  actionTypeFromMethod,
  shouldSkipAudit,
  clientIp,
  parseStoredAuditBody,
  toReadableAuditPayload,
  captureSpecsBefore,
  MAX_BODY_CHARS,
  ACTION_TYPES,
  MODULE_LABELS,
};
