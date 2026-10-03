const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const ExcelJS = require("exceljs");
function load(path, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => dependencies[name] || require(name), exports);
  return exports;
}
process.env.SUPABASE_SECRET_KEY = "test-only-archive-key";
const archive = load("lib/games/history-archive.ts", {});
const rows = [
  { id: "001", member_id: "m1", request_id: "r1", game_key: "wheel", prize: { kind: "coupon", title: "ลด 10%", minSpend: 100, image: "data:image/large" }, tickets_before: 3, tickets_after: 2, points_after: 10, created_at: "2025-12-31T17:01:00Z", member: { name: "=ชื่อทดสอบ" } },
  { id: "002", member_id: "m1", request_id: "r2", game_key: "wheel", prize: { kind: "points", title: "5 แต้ม" }, tickets_before: 2, tickets_after: 1, points_after: 15, created_at: "2026-01-31T17:01:00Z", member: { name: "ลูกค้า" } },
];
let actor = { ownerId: "owner", userId: "owner", role: "owner" };
let rpcCalls = 0;
const db = {
  from() { let after = false; const q = { select: () => q, eq: () => q, lt: () => q, gte: () => q, order: () => q, limit: () => q, gt: () => { after = true; return q; }, then(resolve) { return Promise.resolve({ data: after ? [] : rows, count: rows.length }).then(resolve); } }; return q; },
  async rpc(name, args) { rpcCalls++; assert.equal(name, "clear_game_history"); assert.equal(args.p_count, 2); return { data: { deleted: 2 } }; },
};
const route = load("app/api/admin/games/history/archive/route.ts", { "@/lib/line/server": { crmActor: async () => actor, serviceDb: () => db, noStore: (json, status = 200) => Response.json(json, { status }) }, "@/lib/games/history-archive": archive });
(async () => {
  const response = await route.GET(new Request("http://test/archive?year=all&download=1"));
  assert.equal(response.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ["2026-01", "2026-02"]);
  assert.equal(book.worksheets[0].getRow(2).getCell(3).value, "=ชื่อทดสอบ");
  assert.equal(book.worksheets[0].getRow(2).getCell(3).type, ExcelJS.ValueType.String);
  assert.equal(book.worksheets[0].getRow(2).getCell(11).value, "2026-01-01 00:01:00");
  assert.ok(!book.worksheets[0].getRow(2).getCell(12).value.includes("data:image"));
  const receipt = response.headers.get("X-Archive-Receipt");
  assert.equal(archive.verifyArchive(receipt).count, 2);
  assert.equal(archive.verifyArchive(receipt + "x"), null);
  const clear = token => route.DELETE(new Request("http://test/archive", { method: "DELETE", body: JSON.stringify({ receipt: token, confirmation: "ล้างประวัติ" }) }));
  assert.equal((await clear(receipt)).status, 200);
  actor = { ...actor, role: "staff" };
  assert.equal((await clear(receipt)).status, 403);
  actor = { ...actor, role: "owner", userId: "other", ownerId: "other" };
  assert.equal((await clear(receipt)).status, 400);
  assert.equal(rpcCalls, 1);
  console.log("PASS Excel export: monthly Bangkok tabs, Thai text, formula-safe strings, complete signed receipt, owner isolation.");
})().catch(error => { console.error(error); process.exitCode = 1; });
