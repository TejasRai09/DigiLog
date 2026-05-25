import fs from 'fs';

const p =
  'C:/Users/vivek.kumar/.cursor/projects/c-vivek-PLANT/agent-transcripts/82568441-8b48-45f2-b49b-1c9a76855975/82568441-8b48-45f2-b49b-1c9a76855975.jsonl';
const lines = fs.readFileSync(p, 'utf8').split(/\n/).filter(Boolean);

const needles = [
  'activeTab === \'dashboard\'',
  'md:overflow-y-hidden',
  'z-[310]',
  'MdArrowBack',
  'CHART_LEGEND',
  'grid-template-rows',
  'min-h-[220px]',
  'compare',
];

for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes('DistilleryAnalyticsDashboard')) continue;
  const o = JSON.parse(lines[i]);
  const content = o.message?.content || [];
  for (const c of content) {
    if (c.type !== 'tool_use') continue;
    const path = String(c.input?.path || '');
    if (!path.includes('DistilleryAnalytics')) continue;
    const blob = JSON.stringify(c.input);
    if (c.name === 'StrReplace' && needles.some((n) => blob.includes(n))) {
      console.log(`\n=== line ${i} ${c.name} ===`);
      console.log(blob.length > 20000 ? blob.slice(0, 20000) + '\n...[truncated]' : blob);
    }
  }
}
