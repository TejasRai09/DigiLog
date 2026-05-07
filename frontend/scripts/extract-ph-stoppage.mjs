import fs from 'fs';

const h = fs.readFileSync(
  new URL('../../GSMA Power Logbooks/templates/PHReport_Stoppages.html', import.meta.url),
  'utf8',
);

function selectOptions(id) {
  const re = new RegExp(`<select[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i');
  const m = h.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/<option>([^<]*)<\/option>/g)].map((x) => x[1].trim());
}

const section = selectOptions('section');
const sub = selectOptions('subsection');
const mach = selectOptions('machinery');
const cat = selectOptions('category');

const pad = (arr) => JSON.stringify([''].concat(arr.filter(Boolean)), null, 2);

const out = `/** Parsed from PHReport_Stoppages.html */

export const PH_STOPPAGE_SECTION_OPTIONS = ${pad(section)};

export const PH_STOPPAGE_SUBSECTION_OPTIONS = ${pad(sub)};

export const PH_STOPPAGE_MACHINERY_OPTIONS = ${pad(mach)};

export const PH_STOPPAGE_CATEGORY_OPTIONS = ${pad(cat)};
`;

fs.writeFileSync(new URL('../src/pages/forms/power/phStoppageOptions.js', import.meta.url), out);
