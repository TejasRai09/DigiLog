/** Equipment hierarchy -> markmap markdown (mind map view + standalone HTML export). */

import { ENGINEERING_DISCIPLINES } from '../config/engineeringDisciplines';
import { isHierarchyEquipment, splitSugarLeafLabel } from './hierarchyTreeUtils';

/** Depths rendered as markdown headings; deeper levels become nested list items. */
const MAX_HEADING_DEPTH = 3;

function escapeInline(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]<>|])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function codeSpan(value) {
  const text = String(value ?? '').replace(/`/g, "'").trim();
  return text ? ` \`${text}\`` : '';
}

function groupLabel(node) {
  const count = node.children?.length ?? 0;
  const name = escapeInline(node.name) || 'Untitled';
  return count ? `${name} (${count})` : name;
}

/** Child equipment card living under one department, e.g. "Control valve". */
function cardLabel(card) {
  const name = escapeInline(card?.name) || 'Untitled';
  let label = name;
  if (card?.tagNo) label += codeSpan(card.tagNo);
  return label;
}

function equipmentLabel(node, isSugar) {
  const parts = isSugar ? splitSugarLeafLabel(node) : null;
  const name = escapeInline(parts?.equipmentName || node.name) || 'Untitled';
  let label = `**${name}**`;
  label += codeSpan(node.equipNo);
  const location = escapeInline(parts?.location || node.location || node.histLocation);
  if (location) label += ` — ${location}`;
  return label;
}

/**
 * Flatten a hierarchy tree into markmap-flavoured markdown.
 * Equipment leaves carry the four engineering departments, and each department
 * carries the child equipment cards recorded against it (specs / schedule / history).
 */
export function buildHierarchyMarkdown(tree, options = {}) {
  const {
    apiBase = '/sugar-new',
    includeDisciplines = true,
    cardsByNodeId = null,
    initialExpandLevel = 2,
    colorFreezeLevel = 2,
    maxWidth = 320,
  } = options;

  if (!tree) return '';

  const isSugar = apiBase === '/sugar-new';
  const lines = [
    '---',
    'markmap:',
    `  colorFreezeLevel: ${colorFreezeLevel}`,
    `  initialExpandLevel: ${initialExpandLevel}`,
    `  maxWidth: ${maxWidth}`,
    '---',
    '',
  ];

  const walk = (node, depth) => {
    if (!node) return;
    const isEquipment = isHierarchyEquipment(node);
    const label = isEquipment ? equipmentLabel(node, isSugar) : groupLabel(node);
    const asHeading = depth <= MAX_HEADING_DEPTH;

    if (asHeading) {
      lines.push(`${'#'.repeat(depth + 1)} ${label}`, '');
    } else {
      lines.push(`${'  '.repeat(depth - MAX_HEADING_DEPTH - 1)}- ${label}`);
    }

    if (isEquipment) {
      if (includeDisciplines) {
        const deptIndent = asHeading ? '' : '  '.repeat(depth - MAX_HEADING_DEPTH);
        const cardIndent = `${deptIndent}  `;
        const nodeCards = cardsByNodeId?.[String(node.id)] || null;

        for (const discipline of ENGINEERING_DISCIPLINES) {
          const cards = nodeCards?.[discipline.id] || [];
          const name = escapeInline(discipline.name);
          lines.push(`${deptIndent}- ${cards.length ? `**${name}** (${cards.length})` : name}`);
          for (const card of cards) {
            lines.push(`${cardIndent}- ${cardLabel(card)}`);
          }
        }
        if (asHeading) lines.push('');
      }
      return;
    }

    for (const child of node.children || []) walk(child, depth + 1);
  };

  walk(tree, 0);
  return lines.join('\n');
}

/** Node/equipment counts shown next to the map. */
export function countHierarchyNodes(tree) {
  const stats = { groups: 0, equipment: 0, total: 0, depth: 0 };
  if (!tree) return stats;

  const walk = (node, depth) => {
    stats.total += 1;
    stats.depth = Math.max(stats.depth, depth);
    if (isHierarchyEquipment(node)) {
      stats.equipment += 1;
      return;
    }
    stats.groups += 1;
    for (const child of node.children || []) walk(child, depth + 1);
  };

  walk(tree, 0);
  return stats;
}

/**
 * Self-contained markmap HTML. Opens in any browser; markmap itself is pulled
 * from the CDN on first open, so the file needs internet access to render.
 */
export function buildStandaloneMarkmapHtml(markdown, options = {}) {
  const { title = 'Equipment hierarchy' } = options;
  const safeTitle = String(title).replace(/[<>&]/g, '');
  const safeMarkdown = String(markdown || '').replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, Segoe UI, system-ui, sans-serif; background: #ffffff; color: #0f172a; }
  header { padding: 12px 20px; border-bottom: 1px solid #e2e8f0; background: #fffbeb; }
  header h1 { margin: 0; font-size: 15px; font-weight: 700; color: #92400e; }
  header p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
  svg.markmap { width: 100vw; height: calc(100vh - 62px); display: block; }
</style>
</head>
<body>
<header>
  <h1>${safeTitle}</h1>
  <p>Click a node to expand or collapse. Scroll to zoom, drag to pan. Generated from DigiLog.</p>
</header>
<div class="markmap">
  <script type="text/template">
${safeMarkdown}
  </script>
</div>
<script src="https://cdn.jsdelivr.net/npm/markmap-autoloader@0.18"></script>
</body>
</html>
`;
}

export function markmapFileName(title) {
  const slug = String(title || 'equipment-hierarchy')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'equipment-hierarchy';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug}-markmap-${stamp}.html`;
}
