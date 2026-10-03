import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('app/api/line/member/account/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
for (const counts of [{ dogCount: 2, catCount: 3 }, { dogCount: 0, catCount: 999 }, {}, { dogCount: -1 }, { catCount: 1.5 }, { dogCount: '2' }, { catCount: null }, { dogCount: 1000 }]) {
  let changes;
  const filters = [];
  const query = { update(value) { changes = value; return this; }, eq(key, value) { filters.push([key, value]); return this; }, select() { return this; }, async maybeSingle() { return { data: { name: 'Test Member' }, error: null }; } };
  const exports = {};
  runInNewContext(source, { exports, Response, Request, require: () => ({ verifiedMemberSession: async () => ({ ownerId: 'owner', memberId: 'member', birthday: { birth_date: null, birth_date_changed_at: null }, db: { from: () => query } }) }) });
  const response = await exports.POST(new Request('http://localhost/api/line/member/account', { method: 'POST', body: JSON.stringify({ action: 'update', profile: { firstName: 'Test', lastName: 'Member', phone: '0812345678', ...counts } }) }));
  const valid = Object.values(counts).every(value => Number.isSafeInteger(value) && value >= 0 && value <= 999);
  assert.equal(response.status, valid ? 200 : 400);
  if (valid) {
    assert.equal(changes.dog_count, counts.dogCount);
    assert.equal(changes.cat_count, counts.catCount);
    assert.ok(filters.some(([key, value]) => key === 'owner_id' && value === 'owner'));
    assert.ok(filters.some(([key, value]) => key === 'id' && value === 'member'));
  } else assert.equal(changes, undefined, 'Invalid counts must never reach a write');
}
console.log('PASS: pet counts save with member/owner scope; zero/max accepted; missing fields preserved; negative/fraction/string/null/overflow rejected.');
