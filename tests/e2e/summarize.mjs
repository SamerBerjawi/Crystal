import fs from 'fs';
const r = JSON.parse(fs.readFileSync('results/results.json', 'utf8'));
const rows = [];
const walk = (s, prefix = '') => { for (const sp of s.specs || []) for (const t of sp.tests) for (const res of t.results.slice(-1)) rows.push({ proj: t.projectName, title: prefix + sp.title, status: res.status, err: (res.error?.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 260) }); for (const c of s.suites || []) walk(c, prefix + (c.title && !c.title.endsWith('.ts') ? c.title + ' › ' : '')); };
r.suites.forEach(s => walk(s));
const filter = process.argv[2];
for (const x of rows.filter(x => !filter || x.status !== 'passed')) console.log(`[${x.proj}] ${x.status.toUpperCase()} ${x.title}\n    ${x.err}`);
console.log(Object.entries(rows.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {})));
