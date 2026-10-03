import { readFileSync, readdirSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const target = process.argv[2];
assert.ok(['test', 'production'].includes(target));
const directory = 'artifacts/private-member-backups';
const file = readdirSync(directory).filter(file => file.startsWith(`${target}-`) && file.endsWith('.enc')).sort().at(-1);
assert.ok(file, 'Missing backup');
const buffer = readFileSync(`${directory}/${file}`);
const decipher = createDecipheriv('aes-256-gcm', readFileSync(`${directory}/${file.replace(/\.enc$/, '.key')}`), buffer.subarray(0, 12));
decipher.setAuthTag(buffer.subarray(12, 28));
const snapshot = JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString());
const db = createClient(target === 'test' ? process.env.TEST_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL,
  target === 'test' ? process.env.TEST_SUPABASE_SECRET_KEY : process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from('members').select('id,owner_id,member_code,member_number,points,spending,line_user_id,line_display_name,line_picture_url,line_linked_at,line_profile_synced_at');
assert.equal(error, null);
for (const link of snapshot.links) {
  const member = data.find(row => row.id === link.member_id && row.owner_id === link.owner_id);
  assert.ok(member, 'Original member missing');
  for (const [current, original] of [['line_user_id','line_user_id'],['line_display_name','line_display_name'],['line_picture_url','line_picture_url'],['line_linked_at','linked_at'],['line_profile_synced_at','profile_synced_at']])
    assert.equal(member[current], link[original], `Migrated ${current} differs from backup`);
}
for (const previous of snapshot.members) {
  const current = data.find(row => row.id === previous.id);
  assert.ok(current, 'Member missing');
  assert.equal(current.member_code, previous.member_code);
  assert.equal(current.member_number, previous.member_number);
}
console.log(`PASS: ${target} original LINE links and member UUID/code/number mappings match encrypted backup. Current membership count: ${data.length}.`);
