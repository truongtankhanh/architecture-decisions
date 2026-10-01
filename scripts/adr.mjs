#!/usr/bin/env node
// Decision-record tooling with no dependencies.
//
//   node scripts/adr.mjs new "Title" [--supersedes 7]   create the next record from the template
//   node scripts/adr.mjs index                          regenerate the index in README.md
//   node scripts/adr.mjs check                          validate records, links and the index
//
// `check` is what CI runs. It exits non-zero with one line per problem.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['Proposed', 'Accepted', 'Deprecated', 'Superseded'];
export const REQUIRED_SECTIONS = ['Context', 'Options', 'Decision', 'Consequences'];
const FILE_RE = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const INDEX_START = '<!-- adr-index:start -->';
const INDEX_END = '<!-- adr-index:end -->';

/** Parses one record. Never throws: problems are returned alongside what could be read. */
export function parseRecord(fileName, text) {
  const problems = [];
  const match = FILE_RE.exec(fileName);
  if (!match) problems.push(`file name must look like 0001-short-title.md`);
  const number = match ? Number(match[1]) : NaN;

  const lines = text.split('\n');
  const heading = /^# ADR-(\d{4}): (.+)$/.exec(lines[0] ?? '');
  if (!heading) problems.push(`first line must be "# ADR-NNNN: Title"`);
  else if (Number(heading[1]) !== number) {
    problems.push(`heading number ADR-${heading[1]} does not match the file name`);
  }

  const field = (name) => {
    const line = lines.find((l) => l.startsWith(`- **${name}:** `));
    return line ? line.slice(`- **${name}:** `.length).trim() : undefined;
  };

  const statusText = field('Status');
  let status;
  let supersededBy;
  if (!statusText) problems.push('missing "- **Status:**" line');
  else {
    const superseded = /^Superseded by \[ADR-(\d{4})\]\((\d{4}-[^)]+\.md)\)$/.exec(statusText);
    if (superseded) {
      status = 'Superseded';
      supersededBy = Number(superseded[1]);
      if (!superseded[2].startsWith(superseded[1])) {
        problems.push(`status links ADR-${superseded[1]} to the wrong file`);
      }
    } else if (STATUSES.includes(statusText) && statusText !== 'Superseded') {
      status = statusText;
    } else {
      problems.push(
        `status "${statusText}" must be one of Proposed, Accepted, Deprecated, or "Superseded by [ADR-NNNN](NNNN-….md)"`,
      );
    }
  }

  const date = field('Date');
  if (!date) problems.push('missing "- **Date:**" line');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    problems.push(`date "${date}" must be YYYY-MM-DD`);
  }

  const supersedesText = field('Supersedes');
  const supersedes = supersedesText
    ? [...supersedesText.matchAll(/\[ADR-(\d{4})\]/g)].map((m) => Number(m[1]))
    : [];

  const sections = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());
  for (const section of REQUIRED_SECTIONS) {
    if (!sections.includes(section)) problems.push(`missing "## ${section}" section`);
  }
  const order = REQUIRED_SECTIONS.map((s) => sections.indexOf(s)).filter((i) => i >= 0);
  if (order.some((value, i) => i > 0 && value < order[i - 1])) {
    problems.push(`sections must appear in the order ${REQUIRED_SECTIONS.join(', ')}`);
  }

  return {
    fileName,
    number,
    title: heading?.[2],
    status,
    supersededBy,
    supersedes,
    date,
    problems,
  };
}

/** Checks the set as a whole: numbering and supersession links in both directions. */
export function checkSet(records) {
  const problems = [];
  const byNumber = new Map();
  for (const record of records) {
    if (Number.isNaN(record.number)) continue;
    if (byNumber.has(record.number)) {
      problems.push(`${record.fileName}: number ${record.number} is used twice`);
    }
    byNumber.set(record.number, record);
  }
  const numbers = [...byNumber.keys()].sort((a, b) => a - b);
  numbers.forEach((n, i) => {
    if (n !== i + 1) problems.push(`numbering has a gap: expected ${pad(i + 1)}, found ${pad(n)}`);
  });

  for (const record of records) {
    if (record.supersededBy !== undefined) {
      const newer = byNumber.get(record.supersededBy);
      if (!newer) {
        problems.push(
          `${record.fileName}: superseded by ADR-${pad(record.supersededBy)}, which does not exist`,
        );
      } else if (!newer.supersedes.includes(record.number)) {
        problems.push(
          `${newer.fileName}: must say "- **Supersedes:** [ADR-${pad(record.number)}](${record.fileName})"`,
        );
      }
    }
    for (const older of record.supersedes) {
      const target = byNumber.get(older);
      if (!target)
        problems.push(`${record.fileName}: supersedes ADR-${pad(older)}, which does not exist`);
      else if (target.supersededBy !== record.number) {
        problems.push(
          `${target.fileName}: status must be "Superseded by [ADR-${pad(record.number)}](${record.fileName})"`,
        );
      }
    }
  }
  return problems;
}

/** Markdown table of all records, newest decisions last, as embedded in README.md. */
export function renderIndex(records, dir = 'decisions') {
  const rows = [...records]
    .sort((a, b) => a.number - b.number)
    .map((r) => {
      const status =
        r.status === 'Superseded' ? `Superseded by ADR-${pad(r.supersededBy)}` : r.status;
      const title = r.status === 'Superseded' ? `~~${r.title}~~` : r.title;
      return `| [${pad(r.number)}](${dir}/${r.fileName}) | ${title} | ${status} |`;
    });
  return ['| ADR | Decision | Status |', '| --- | --- | --- |', ...rows].join('\n');
}

export function replaceIndex(readme, table) {
  const start = readme.indexOf(INDEX_START);
  const end = readme.indexOf(INDEX_END);
  if (start < 0 || end < start) throw new Error(`README.md needs ${INDEX_START} … ${INDEX_END}`);
  return `${readme.slice(0, start + INDEX_START.length)}\n\n${table}\n\n${readme.slice(end)}`;
}

/** Relative links in a Markdown file that point at files that do not exist. */
export function brokenLinks(root, file, text) {
  const broken = [];
  const withoutCode = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const [, target] of withoutCode.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    const path = target.split('#')[0];
    if (!existsSync(resolve(dirname(join(root, file)), path))) broken.push(target);
  }
  return broken;
}

export const normalizeTable = (text) =>
  text.replace(/ *\| */g, '|').replace(/\|-{3,}(?=\|)/g, '|---');

export const pad = (n) => String(n).padStart(4, '0');
export const slug = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---------------------------------------------------------------------------------------------

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decisionsDir = join(root, 'decisions');
const readmePath = join(root, 'README.md');

function loadRecords() {
  return readdirSync(decisionsDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => parseRecord(f, readFileSync(join(decisionsDir, f), 'utf8')));
}

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git'].includes(entry.name)) return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [relative(root, full)] : [];
  });
}

function check() {
  const records = loadRecords();
  const problems = [
    ...records.flatMap((r) => r.problems.map((p) => `decisions/${r.fileName}: ${p}`)),
    ...checkSet(records),
  ];
  for (const file of markdownFiles(root)) {
    for (const link of brokenLinks(root, file, readFileSync(join(root, file), 'utf8'))) {
      problems.push(`${file}: broken link ${link}`);
    }
  }
  const readme = readFileSync(readmePath, 'utf8');
  if (records.every((r) => r.problems.length === 0)) {
    // Compare ignoring table padding, so Prettier's column alignment is not a difference.
    if (normalizeTable(replaceIndex(readme, renderIndex(records))) !== normalizeTable(readme)) {
      problems.push('README.md: decision index is out of date — run `npm run adr:index`');
    }
  }
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    console.error(`\n${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log(`✓ ${records.length} decision records, links and index are consistent.`);
}

function index() {
  const records = loadRecords();
  const readme = readFileSync(readmePath, 'utf8');
  writeFileSync(readmePath, replaceIndex(readme, renderIndex(records)));
  console.log(`Index updated with ${records.length} records.`);
}

function create(args) {
  const supersedesAt = args.indexOf('--supersedes');
  const supersedes = supersedesAt >= 0 ? Number(args[supersedesAt + 1]) : undefined;
  const title = args
    .filter((_, i) => i !== supersedesAt && i !== supersedesAt + 1)
    .join(' ')
    .trim();
  if (!title) throw new Error('usage: adr new "Title" [--supersedes N]');

  const records = loadRecords();
  const number = Math.max(0, ...records.map((r) => r.number)) + 1;
  const fileName = `${pad(number)}-${slug(title)}.md`;
  const today = new Date().toISOString().slice(0, 10);

  let body = readFileSync(join(root, 'templates', 'adr.md'), 'utf8')
    .replace('ADR-NNNN: Title', `ADR-${pad(number)}: ${title}`)
    .replace('YYYY-MM-DD', today);

  if (supersedes !== undefined) {
    const older = records.find((r) => r.number === supersedes);
    if (!older) throw new Error(`ADR-${pad(supersedes)} does not exist`);
    body = body.replace(
      /(- \*\*Date:\*\* .+\n)/,
      `$1- **Supersedes:** [ADR-${pad(supersedes)}](${older.fileName})\n`,
    );
    const olderPath = join(decisionsDir, older.fileName);
    writeFileSync(
      olderPath,
      readFileSync(olderPath, 'utf8').replace(
        /- \*\*Status:\*\* .+/,
        `- **Status:** Superseded by [ADR-${pad(number)}](${fileName})`,
      ),
    );
  }

  writeFileSync(join(decisionsDir, fileName), body);
  index();
  console.log(`Created decisions/${fileName}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'check') check();
    else if (command === 'index') index();
    else if (command === 'new') create(args);
    else {
      console.error('usage: adr <new "Title" [--supersedes N] | index | check>');
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
