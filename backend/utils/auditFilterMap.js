/**
 * Prefilled Audit cascade + SQL helpers mapping Area/Section/Detail → log columns.
 * Keep labels in sync with frontend/src/utils/auditFilterTree.js.
 *
 * Historical log policy: NEVER UPDATE or DELETE existing audit_logs /
 * user_activity_logs / user_sessions rows. Filters only add SELECT WHERE
 * predicates (best-effort against whatever labels were stored at write time).
 * New activity/change rows may use improved labels going forward.
 */

const BI_DASHBOARD_FILTER_LABELS = [
  'Distillery Operations — Analytics',
  'Milling Division Cockpit',
  'Purchy Analysis',
  'Brix Sampling Analytics',
  'Centre Maturity Dashboard',
  'Cane Performance Dashboard',
  'Power House Dashboard',
  'Management Dashboard',
];

const CONFIG_TAB_FILTER_LABELS = [
  'Employees',
  'Employee Categories',
  'Season Mapping',
  'BI Dashboards',
  'Audit & Activity',
  'Maintenance History Approval',
];

const CRUD_FILTER_LABELS = ['Create', 'Update', 'Delete'];

const AUDIT_FILTER_TREE = {
  Home: {
    'Forms Hub': ['Forms cards', 'Equipment specification cards'],
    'BI Control Tower': [...BI_DASHBOARD_FILTER_LABELS],
  },
  Approvals: {
    'Sugar House': ['Approved', 'Sent for modification'],
    'Power Plant': ['Approved', 'Sent for modification'],
    'Production House': ['Approved', 'Sent for modification'],
  },
  Config: Object.fromEntries(CONFIG_TAB_FILTER_LABELS.map((t) => [t, [...CRUD_FILTER_LABELS]])),
  'Data Upload': {
    Purchy: [],
    Management: [],
    Milling: [],
  },
};

const EQUIP_SECTIONS = [
  'Power Plant Equipment',
  'Sugar House Equipment',
  'Production House Equipment',
];

const EQUIP_MODULES = [
  'Power Plant Equipment',
  'Power Plant Equipment (Legacy)',
  'Sugar House Equipment',
  'Production House Equipment',
];

const EQUIP_HUB_FILTER = {
  'Sugar House Equipment': {
    sections: ['Sugar House Equipment'],
    modules: ['Sugar House Equipment'],
    pathLike: ['%/sugar-new%', '%/sugar-house%', '%sugar%'],
    pageLike: ['%/sugar-house-equipment%', '%/sugar%'],
  },
  'Power Plant Equipment': {
    sections: ['Power Plant Equipment'],
    modules: ['Power Plant Equipment', 'Power Plant Equipment (Legacy)'],
    pathLike: ['%/power-new%', '%/power/%', '%power%'],
    pageLike: ['%/power-plant-equipment%', '%/power/%', '%/power'],
  },
  'Production House Equipment': {
    sections: ['Production House Equipment'],
    modules: ['Production House Equipment'],
    pathLike: ['%/production-house%', '%production%'],
    pageLike: ['%/production-house-equipment%', '%/production%'],
  },
};

const EQUIP_SCREEN_FILTER = {
  Specs: {
    labels: ['Specs', 'Equipment Specification', 'specifications'],
    pathLike: ['%/specs%', '%/specs'],
    pageLike: ['%/specs%', '%specs%'],
  },
  'OEM Schedule': {
    labels: ['OEM Schedule', 'Schedule'],
    pathLike: ['%/schedule%', '%/schedule'],
    pageLike: ['%/schedule%', '%schedule%', '%mechanical%'],
  },
  'Life History': {
    labels: ['Life History', 'Maintenance History', 'History'],
    pathLike: ['%/history%', '%/history'],
    pageLike: ['%/history%', '%history%'],
  },
};

const CONFIG_TAB_SCREEN_ALIASES = {
  Employees: ['Employees', 'Employee', 'Users'],
  'Employee Categories': ['Employee Categories', 'Categories'],
  'Season Mapping': ['Season Mapping'],
  'BI Dashboards': ['BI Dashboards', 'Bi Dashboards', 'BI Settings'],
  'Audit & Activity': ['Audit & Activity', 'Audit Log', 'Audit'],
  'Maintenance History Approval': ['Maintenance History Approval', 'Maintenance History'],
};

const APPROVAL_DOMAIN = {
  'Sugar House': { activityCards: ['Sugar House'], pathLike: ['%sugar%', '%/shn_%'] },
  'Power Plant': { activityCards: ['Power Plant'], pathLike: ['%power%', '%/ppn_%'] },
  'Production House': { activityCards: ['Production House', 'Production'], pathLike: ['%production%', '%/phn_%'] },
};

const UPLOAD_BRANCH = {
  Purchy: { like: ['%purchy%'] },
  Management: { like: ['%management%'] },
  Milling: { like: ['%milling%'] },
};

function auditFilterRoots() {
  return Object.keys(AUDIT_FILTER_TREE);
}

function auditFilterBranches(root) {
  if (!root || !AUDIT_FILTER_TREE[root]) return [];
  return Object.keys(AUDIT_FILTER_TREE[root]);
}

function auditFilterLeaves(root, branch) {
  if (!root || !branch || !AUDIT_FILTER_TREE[root]) return [];
  return AUDIT_FILTER_TREE[root][branch] || [];
}

function orGroup(parts) {
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' OR ')})`;
}

/**
 * Append WHERE fragments for activity_logs-style columns (alias optional).
 * @param {'activity'|'session_activity'} mode
 */
function pushActivityTreeFilters(where, params, { root, branch, leaf, card, screen }, alias = '') {
  const col = (name) => (alias ? `${alias}.${name}` : name);
  const r = String(root || '').trim();
  const b = String(branch || '').trim();
  const l = String(leaf || '').trim();
  const c = String(card || '').trim();
  const s = String(screen || '').trim();
  if (!r) return;

  if (r === 'Home') {
    if (!b) {
      where.push(`(
        ${col('section')} IN ('Forms Hub', 'BI Control Tower', 'Dashboard', ${EQUIP_SECTIONS.map(() => '?').join(',')})
        OR ${col('page_path')} LIKE '/forms%'
        OR ${col('page_path')} LIKE '/bi%'
        OR ${col('page_path')} LIKE '/apps/%'
        OR ${col('page_path')} LIKE '/power%'
        OR ${col('page_path')} LIKE '/sugar%'
        OR ${col('page_path')} LIKE '/production%'
        OR ${col('page_path')} LIKE '/equipment%'
        OR ${col('page_path')} LIKE '/ehs%'
      )`);
      params.push(...EQUIP_SECTIONS);
      return;
    }
    if (b === 'Forms Hub') {
      if (l === 'Equipment specification cards') {
        if (c && EQUIP_HUB_FILTER[c]) {
          const hub = EQUIP_HUB_FILTER[c];
          where.push(orGroup([
            ...hub.sections.map(() => `${col('section')} = ?`),
            ...hub.pageLike.map(() => `${col('page_path')} LIKE ?`),
            ...hub.sections.map(() => `${col('display_path')} LIKE ?`),
          ]));
          params.push(
            ...hub.sections,
            ...hub.pageLike,
            ...hub.sections.map((x) => `%${x}%`),
          );
        } else {
          where.push(`${col('section')} IN (${EQUIP_SECTIONS.map(() => '?').join(',')})`);
          params.push(...EQUIP_SECTIONS);
        }
        if (s && EQUIP_SCREEN_FILTER[s]) {
          const scr = EQUIP_SCREEN_FILTER[s];
          where.push(orGroup([
            ...scr.labels.map(() => `${col('form_or_dashboard')} = ?`),
            ...scr.labels.map(() => `${col('form_or_dashboard')} LIKE ?`),
            ...scr.pageLike.map(() => `${col('page_path')} LIKE ?`),
            ...scr.labels.map(() => `${col('display_path')} LIKE ?`),
          ]));
          params.push(
            ...scr.labels,
            ...scr.labels.map((x) => `%${x}%`),
            ...scr.pageLike,
            ...scr.labels.map((x) => `%${x}%`),
          );
        }
      } else if (l === 'Forms cards') {
        where.push(`(
          ${col('section')} = 'Forms Hub'
          OR ${col('page_path')} LIKE '/forms/%'
          OR ${col('page_path')} LIKE '/forms-hub%'
          OR ${col('page_path')} LIKE '/apps/%'
          OR ${col('page_path')} LIKE '/ehs%'
          OR ${col('page_path')} LIKE '/production'
          OR ${col('page_path')} LIKE '/production/%'
        )`);
        where.push(`${col('section')} NOT IN (${EQUIP_SECTIONS.map(() => '?').join(',')})`);
        params.push(...EQUIP_SECTIONS);
        if (c) {
          where.push(orGroup([
            `${col('card')} = ?`,
            `${col('card')} LIKE ?`,
            `${col('display_path')} LIKE ?`,
            `${col('form_or_dashboard')} LIKE ?`,
          ]));
          params.push(c, `%${c}%`, `%${c}%`, `%${c}%`);
        }
      } else {
        where.push(`(
          ${col('section')} = 'Forms Hub'
          OR ${col('section')} IN (${EQUIP_SECTIONS.map(() => '?').join(',')})
          OR ${col('page_path')} LIKE '/forms%'
          OR ${col('page_path')} LIKE '/apps/%'
          OR ${col('page_path')} LIKE '/power%'
          OR ${col('page_path')} LIKE '/sugar%'
          OR ${col('page_path')} LIKE '/production%'
          OR ${col('page_path')} LIKE '/equipment%'
        )`);
        params.push(...EQUIP_SECTIONS);
      }
      return;
    }
    if (b === 'BI Control Tower') {
      where.push(`${col('section')} = 'BI Control Tower'`);
      if (l) {
        where.push(`${col('form_or_dashboard')} = ?`);
        params.push(l);
      }
      return;
    }
  }

  if (r === 'Approvals') {
    where.push(`(
      ${col('section')} = 'Approvals'
      OR ${col('page_path')} LIKE '/maintenance/approvals%'
    )`);
    if (b) {
      const dom = APPROVAL_DOMAIN[b];
      if (dom) {
        const cardParts = dom.activityCards.map(() => `${col('card')} = ?`);
        const pathParts = dom.pathLike.map(() => `${col('page_path')} LIKE ?`);
        const dispParts = dom.activityCards.map(() => `${col('display_path')} LIKE ?`);
        where.push(orGroup([...cardParts, ...pathParts, ...dispParts]));
        params.push(
          ...dom.activityCards,
          ...dom.pathLike,
          ...dom.activityCards.map((c) => `%${c}%`),
        );
      }
    }
    if (l) {
      where.push(`(
        ${col('form_or_dashboard')} = ?
        OR ${col('display_path')} LIKE ?
        OR ${col('element_label')} LIKE ?
      )`);
      params.push(l, `%${l}%`, `%${l}%`);
    }
    return;
  }

  if (r === 'Config') {
    where.push(`(
      ${col('section')} = 'Admin Config'
      OR ${col('page_path')} LIKE '/admin/%'
    )`);
    if (b) {
      const aliases = CONFIG_TAB_SCREEN_ALIASES[b] || [b];
      where.push(orGroup([
        ...aliases.map(() => `${col('card')} = ?`),
        `${col('display_path')} LIKE ?`,
        `${col('page_path')} LIKE ?`,
      ]));
      params.push(...aliases, `%${b}%`, `%${b.toLowerCase().replace(/[^a-z0-9]+/g, '-')}%`);
    }
    // leaf CRUD does not apply to page-view activity
    return;
  }

  if (r === 'Data Upload') {
    where.push(`(
      ${col('section')} = 'Data Upload'
      OR ${col('page_path')} LIKE '/data-upload%'
    )`);
    if (b) {
      const up = UPLOAD_BRANCH[b];
      where.push(orGroup([
        `${col('card')} = ?`,
        `${col('form_or_dashboard')} = ?`,
        `${col('display_path')} LIKE ?`,
        ...(up ? up.like.map(() => `${col('page_path')} LIKE ?`) : []),
        ...(up ? up.like.map(() => `${col('card')} LIKE ?`) : []),
        ...(up ? up.like.map(() => `${col('form_or_dashboard')} LIKE ?`) : []),
      ]));
      params.push(b, b, `%${b}%`);
      if (up) {
        params.push(...up.like, ...up.like, ...up.like);
      }
    }
  }
}

function pushAuditLogTreeFilters(where, params, { root, branch, leaf, card, screen }) {
  const r = String(root || '').trim();
  const b = String(branch || '').trim();
  const l = String(leaf || '').trim();
  const c = String(card || '').trim();
  const s = String(screen || '').trim();
  if (!r) return;

  if (r === 'Home') {
    if (!b) {
      where.push(`(
        module IN ('Forms', 'BI Control Tower', 'Homepage Cards', 'Apps')
        OR module IN (${EQUIP_MODULES.map(() => '?').join(',')})
        OR path LIKE '/api/forms%'
        OR path LIKE '/api/bi%'
        OR path LIKE '/api/apps%'
        OR path LIKE '/api/homepage-cards%'
        OR path LIKE '/api/power%'
        OR path LIKE '/api/sugar%'
        OR path LIKE '/api/production%'
        OR path LIKE '/api/equipment%'
      )`);
      params.push(...EQUIP_MODULES);
      return;
    }
    if (b === 'Forms Hub') {
      if (l === 'Equipment specification cards') {
        if (c && EQUIP_HUB_FILTER[c]) {
          const hub = EQUIP_HUB_FILTER[c];
          where.push(orGroup([
            ...hub.modules.map(() => 'module = ?'),
            ...hub.pathLike.map(() => 'path LIKE ?'),
            ...hub.sections.map(() => 'display_path LIKE ?'),
          ]));
          params.push(
            ...hub.modules,
            ...hub.pathLike,
            ...hub.sections.map((x) => `%${x}%`),
          );
        } else {
          where.push(`(
            module IN (${EQUIP_MODULES.map(() => '?').join(',')})
            OR path LIKE '/api/power%'
            OR path LIKE '/api/sugar%'
            OR path LIKE '/api/production-house%'
            OR path LIKE '/api/equipment%'
          )`);
          params.push(...EQUIP_MODULES);
        }
        if (s && EQUIP_SCREEN_FILTER[s]) {
          const scr = EQUIP_SCREEN_FILTER[s];
          where.push(orGroup([
            ...scr.labels.map(() => 'screen = ?'),
            ...scr.pathLike.map(() => 'path LIKE ?'),
            ...scr.labels.map(() => 'action_summary LIKE ?'),
            ...scr.labels.map(() => 'display_path LIKE ?'),
          ]));
          params.push(
            ...scr.labels,
            ...scr.pathLike,
            ...scr.labels.map((x) => `%${x}%`),
            ...scr.labels.map((x) => `%${x}%`),
          );
        }
      } else if (l === 'Forms cards') {
        where.push(`(
          module IN ('Forms', 'Homepage Cards', 'Apps')
          OR path LIKE '/api/forms%'
          OR path LIKE '/api/homepage-cards%'
          OR path LIKE '/api/apps%'
        )`);
        if (c) {
          where.push(orGroup([
            'resource_name LIKE ?',
            'action_summary LIKE ?',
            'display_path LIKE ?',
            'path LIKE ?',
          ]));
          const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, '%');
          params.push(`%${c}%`, `%${c}%`, `%${c}%`, `%${slug}%`);
        }
      } else {
        where.push(`(
          module IN ('Forms', 'Homepage Cards', 'Apps')
          OR module IN (${EQUIP_MODULES.map(() => '?').join(',')})
          OR path LIKE '/api/forms%'
          OR path LIKE '/api/power%'
          OR path LIKE '/api/sugar%'
          OR path LIKE '/api/production%'
          OR path LIKE '/api/equipment%'
        )`);
        params.push(...EQUIP_MODULES);
      }
      return;
    }
    if (b === 'BI Control Tower') {
      where.push(`(module = 'BI Control Tower' OR path LIKE '/api/bi%')`);
      if (l) {
        where.push(`(
          resource_name = ?
          OR action_summary LIKE ?
          OR display_path LIKE ?
          OR path LIKE ?
        )`);
        const slug = l.toLowerCase().replace(/[^a-z0-9]+/g, '%');
        params.push(l, `%${l}%`, `%${l}%`, `%${slug}%`);
      }
      return;
    }
  }

  if (r === 'Approvals') {
    where.push(`(
      path LIKE '%/change-requests%'
      OR path LIKE '%/maintenance-approval%'
      OR action_summary LIKE '%approv%'
      OR action_summary LIKE '%modification%'
      OR display_path LIKE '%Approval%'
    )`);
    if (b) {
      const dom = APPROVAL_DOMAIN[b];
      if (dom) {
        where.push(orGroup([
          ...dom.pathLike.map(() => 'path LIKE ?'),
          ...dom.activityCards.map(() => 'action_summary LIKE ?'),
          ...dom.activityCards.map(() => 'display_path LIKE ?'),
          ...dom.activityCards.map(() => 'module LIKE ?'),
        ]));
        params.push(
          ...dom.pathLike,
          ...dom.activityCards.map((c) => `%${c}%`),
          ...dom.activityCards.map((c) => `%${c}%`),
          ...dom.activityCards.map((c) => `%${c}%`),
        );
      }
    }
    if (l === 'Approved') {
      where.push(`(
        path LIKE '%/approve%'
        OR action_summary LIKE '%Approved%'
        OR action_summary LIKE '%approved%'
      )`);
    } else if (l === 'Sent for modification') {
      where.push(`(
        path LIKE '%modif%'
        OR action_summary LIKE '%modification%'
        OR action_summary LIKE '%Needs modification%'
      )`);
    }
    return;
  }

  if (r === 'Config') {
    where.push(`(module = 'Admin Config' OR path LIKE '/api/admin/%')`);
    if (b) {
      const aliases = CONFIG_TAB_SCREEN_ALIASES[b] || [b];
      where.push(orGroup([
        ...aliases.map(() => 'screen = ?'),
        ...aliases.map(() => 'action_summary LIKE ?'),
        ...aliases.map(() => 'display_path LIKE ?'),
      ]));
      params.push(
        ...aliases,
        ...aliases.map((a) => `%${a}%`),
        ...aliases.map((a) => `%${a}%`),
      );
    }
    if (l && CRUD_FILTER_LABELS.includes(l)) {
      const methods = l === 'Create' ? ['POST'] : l === 'Delete' ? ['DELETE'] : ['PUT', 'PATCH'];
      where.push(`(action_type = ? OR (action_type IS NULL AND method IN (${methods.map(() => '?').join(',')})))`);
      params.push(l, ...methods);
    }
    return;
  }

  if (r === 'Data Upload') {
    where.push(`(module = 'Data Upload' OR path LIKE '/api/data-upload%')`);
    if (b) {
      const up = UPLOAD_BRANCH[b];
      if (up) {
        where.push(orGroup([
          ...up.like.map(() => 'path LIKE ?'),
          ...up.like.map(() => 'action_summary LIKE ?'),
          ...up.like.map(() => 'display_path LIKE ?'),
          ...up.like.map(() => 'resource_name LIKE ?'),
        ]));
        params.push(...up.like, ...up.like, ...up.like, ...up.like);
      }
    }
  }
}

/**
 * Session filter: sessions that have at least one matching activity row.
 */
function pushSessionTreeFilters(where, params, tree) {
  const r = String(tree.root || '').trim();
  if (!r) return;

  const innerWhere = ['a.session_id = user_sessions.session_id'];
  const innerParams = [];
  pushActivityTreeFilters(innerWhere, innerParams, tree, 'a');

  where.push(`EXISTS (
    SELECT 1 FROM user_activity_logs a
    WHERE ${innerWhere.join(' AND ')}
  )`);
  params.push(...innerParams);
}

module.exports = {
  AUDIT_FILTER_TREE,
  BI_DASHBOARD_FILTER_LABELS,
  CONFIG_TAB_FILTER_LABELS,
  CRUD_FILTER_LABELS,
  auditFilterRoots,
  auditFilterBranches,
  auditFilterLeaves,
  pushActivityTreeFilters,
  pushAuditLogTreeFilters,
  pushSessionTreeFilters,
};
