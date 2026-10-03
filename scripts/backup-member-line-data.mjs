import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const target = process.argv[2];
assert.ok(['production', 'test'].includes(target));
const url = target === 'test' ? process.env.TEST_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = target === 'test' ? process.env.TEST_SUPABASE_SECRET_KEY : process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && secret, 'Missing database configuration');
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
async function rows(table) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from(table).select('*').order('id').range(offset, offset + 999);
    if (result.error) throw new Error(`Backup failed: ${table}`);
    all.push(...result.data);
    if (result.data.length < 1000) return all;
  }
}
const [members, links] = await Promise.all([rows('members'), rows('line_member_links')]);
assert.ok(links.every(link => members.some(member => member.id === link.member_id && member.owner_id === link.owner_id)));
const schemaSources = Object.fromEntries(['20260928100018_line_member_registration.sql', '20260928103924_line_inbox_connection.sql', '20261001155319_remove_line_inbox.sql', '20261002110000_line_member_transfer.sql'].map(file => [file, readFileSync(`supabase/migrations/${file}`, 'utf8')]));
const payload = Buffer.from(JSON.stringify({ target, createdAt: new Date().toISOString(), members, links, schemaSources }));
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
const tag = cipher.getAuthTag();
const directory = 'artifacts/private-member-backups';
mkdirSync(directory, { recursive: true });
const base = `${directory}/${target}-${Date.now()}`;
writeFileSync(`${base}.enc`, Buffer.concat([iv, tag, encrypted]));
writeFileSync(`${base}.key`, key, { mode: 0o600 });
const stored = readFileSync(`${base}.enc`);
const decipher = createDecipheriv('aes-256-gcm', readFileSync(`${base}.key`), stored.subarray(0, 12));
decipher.setAuthTag(stored.subarray(12, 28));
assert.deepEqual(Buffer.concat([decipher.update(stored.subarray(28)), decipher.final()]), payload);
console.log(`Verified encrypted ${target} backup: ${members.length} members, ${links.length} links. ${base}.enc`);
