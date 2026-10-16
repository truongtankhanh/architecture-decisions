import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  brokenLinks,
  checkSet,
  normalizeTable,
  parseNewArgs,
  parseRecord,
  renderIndex,
  replaceIndex,
  slug,
} from './adr.mjs';

const record = ({ n = 1, title = 'Use things', status = 'Accepted', extra = '', sections } = {}) =>
  [
    `# ADR-${String(n).padStart(4, '0')}: ${title}`,
    '',
    `- **Status:** ${status}`,
    '- **Date:** 2026-10-01',
    extra,
    '',
    ...(sections ?? ['Context', 'Options', 'Decision', 'Consequences']).map(
      (s) => `## ${s}\n\nText.\n`,
    ),
  ].join('\n');

test('a well-formed record has no problems', () => {
  const parsed = parseRecord('0001-use-things.md', record());
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.number, 1);
  assert.equal(parsed.title, 'Use things');
  assert.equal(parsed.status, 'Accepted');
});

test('file name, heading and number must agree', () => {
  assert.match(parseRecord('1-things.md', record()).problems.join(), /file name/);
  assert.match(parseRecord('0002-things.md', record()).problems.join(), /does not match/);
});

test('status must be one of the lifecycle states', () => {
  assert.match(
    parseRecord('0001-x.md', record({ status: 'Done' })).problems.join(),
    /status "Done"/,
  );
  const superseded = parseRecord(
    '0001-x.md',
    record({ status: 'Superseded by [ADR-0002](0002-y.md)' }),
  );
  assert.deepEqual(superseded.problems, []);
  assert.equal(superseded.status, 'Superseded');
  assert.equal(superseded.supersededBy, 2);
});

test('required sections must exist and keep their order', () => {
  const missing = parseRecord('0001-x.md', record({ sections: ['Context', 'Decision'] }));
  assert.match(missing.problems.join(), /missing "## Options"/);
  const shuffled = parseRecord(
    '0001-x.md',
    record({ sections: ['Context', 'Decision', 'Options', 'Consequences'] }),
  );
  assert.match(shuffled.problems.join(), /order/);
});

test('numbering must be contiguous and unique', () => {
  const one = parseRecord('0001-a.md', record({ n: 1 }));
  const three = parseRecord('0003-c.md', record({ n: 3 }));
  assert.match(checkSet([one, three]).join(), /expected 0002, found 0003/);
});

test('supersession must be recorded on both sides', () => {
  const older = parseRecord(
    '0001-a.md',
    record({ n: 1, status: 'Superseded by [ADR-0002](0002-b.md)' }),
  );
  const newerWithout = parseRecord('0002-b.md', record({ n: 2 }));
  assert.match(checkSet([older, newerWithout]).join(), /must say "- \*\*Supersedes:\*\*/);

  const newer = parseRecord(
    '0002-b.md',
    record({ n: 2, extra: '- **Supersedes:** [ADR-0001](0001-a.md)' }),
  );
  assert.deepEqual(checkSet([older, newer]), []);

  const stillAccepted = parseRecord('0001-a.md', record({ n: 1 }));
  assert.match(checkSet([stillAccepted, newer]).join(), /status must be "Superseded by/);
});

test('index lists records in order and strikes superseded titles', () => {
  const records = [
    parseRecord(
      '0002-b.md',
      record({ n: 2, title: 'New', extra: '- **Supersedes:** [ADR-0001](0001-a.md)' }),
    ),
    parseRecord(
      '0001-a.md',
      record({ n: 1, title: 'Old', status: 'Superseded by [ADR-0002](0002-b.md)' }),
    ),
  ];
  const table = renderIndex(records);
  const rows = table.split('\n').slice(2);
  assert.equal(rows[0], '| [0001](decisions/0001-a.md) | ~~Old~~ | Superseded by ADR-0002 |');
  assert.equal(rows[1], '| [0002](decisions/0002-b.md) | New | Accepted |');

  const readme = 'intro\n<!-- adr-index:start -->\nstale\n<!-- adr-index:end -->\nrest';
  assert.equal(
    replaceIndex(readme, table),
    `intro\n<!-- adr-index:start -->\n\n${table}\n\n<!-- adr-index:end -->\nrest`,
  );
});

test('relative links are resolved, external links and code are ignored', () => {
  const root = mkdtempSync(join(tmpdir(), 'adr-'));
  mkdirSync(join(root, 'decisions'));
  writeFileSync(join(root, 'decisions', '0001-a.md'), '');
  const text = [
    '[ok](decisions/0001-a.md#context)',
    '[missing](decisions/0009-z.md)',
    '[web](https://example.com/x.md)',
    '[anchor](#section)',
    '`[code](nope.md)`',
  ].join('\n');
  assert.deepEqual(brokenLinks(root, 'README.md', text), ['decisions/0009-z.md']);
});

test('slugs are ASCII and hyphenated', () => {
  assert.equal(
    slug('Reach cameras through the site’s VMS'),
    'reach-cameras-through-the-site-s-vms',
  );
  assert.equal(slug('  Ăn được: Tiếng Việt  '), 'an-duoc-tieng-viet');
});

test('index comparison ignores Prettier column alignment', () => {
  const plain = '| ADR | Decision |\n| --- | --- |\n| [0001](x.md) | Use things |';
  const aligned =
    '| ADR          | Decision   |\n| ------------ | ---------- |\n| [0001](x.md) | Use things |';
  assert.equal(normalizeTable(plain), normalizeTable(aligned));
  assert.notEqual(normalizeTable(plain), normalizeTable(aligned.replace('Use', 'Avoid')));
});

test('new takes the title with or without --supersedes', () => {
  assert.deepEqual(parseNewArgs(['Use things']), { title: 'Use things', supersedes: undefined });
  assert.deepEqual(parseNewArgs(['Use', 'things']), { title: 'Use things', supersedes: undefined });
  assert.deepEqual(parseNewArgs(['Use things', '--supersedes', '8']), {
    title: 'Use things',
    supersedes: 8,
  });
  assert.deepEqual(parseNewArgs(['--supersedes', '8', 'Use things']), {
    title: 'Use things',
    supersedes: 8,
  });
  assert.throws(() => parseNewArgs([]), /usage/);
  assert.throws(() => parseNewArgs(['x', '--supersedes', 'eight']), /record number/);
});
