import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  dependencies["@/lib/line/test-catalog"] = { prepareTestItem: async () => null };
  const exports = {};
  runInNewContext(code, { exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, Response });
  return exports;
}

const { singleFlight } = load("lib/single-flight.ts");
const shared = singleFlight();
let calls = 0;
let release;
const job = () => { calls++; return new Promise(resolve => { release = resolve; }); };
const first = shared("member-a", job);
const duplicate = shared("member-a", job);
assert.equal(first, duplicate, "Concurrent requests must share work");
await Promise.resolve();
release("verified");
assert.equal(await first, "verified");
assert.equal(calls, 1);
await shared("member-a", async () => { calls++; });
assert.equal(calls, 2, "Settled authentication must not be cached");
await assert.rejects(shared("member-a", async () => { throw new Error("expired"); }));
assert.equal(await shared("member-a", async () => "retry"), "retry");
assert.notEqual(shared("member-a", async () => "a"), shared("member-b", async () => "b"));

const couponId = "11111111-1111-4111-8111-111111111111";
const request = () => new Request("http://localhost/api/line/member/coupon-qr", {
  method: "POST", body: JSON.stringify({ action: "status", accessToken: "test-token", couponId }),
});
for (const status of ["available", "used", null]) {
  const filters = {};
  const query = { select() { return this; }, eq(key, value) { filters[key] = value; return this; },
    async maybeSingle() { return { data: status ? { status } : null, error: null }; } };
  const route = load("app/api/line/member/coupon-qr/route.ts", {
    "@/lib/line/member-session": { verifiedMemberSession: async () => ({
      ownerId: "owner-a", memberId: "member-a", db: {
        from(table) { assert.equal(table, "member_coupon_claims"); return query; },
        rpc() { throw new Error("Status checks must never issue or redeem a coupon"); },
      },
    }) },
  });
  const response = await route.POST(request());
  assert.deepEqual(await response.json(), { used: status === "used" });
  assert.deepEqual(filters, { owner_id: "owner-a", member_id: "member-a", coupon_id: couponId });
  assert.equal(response.headers.get("cache-control"), "no-store");
}
const denied = load("app/api/line/member/coupon-qr/route.ts", {
  "@/lib/line/member-session": { verifiedMemberSession: async () => ({ error: "Unauthorized", status: 401 }) },
});
assert.equal((await denied.POST(request())).status, 401);
console.log("PASS: concurrent login deduplication, fresh auth after settlement, retry, identity separation, and member-scoped coupon status.");
