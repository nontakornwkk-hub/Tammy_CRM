import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { crmActor, noStore, serviceDb } from "@/lib/line/server";
import { archiveScope, scopeBounds, signArchive, verifyArchive } from "@/lib/games/history-archive";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อม" }, 503);
  const url = new URL(request.url);
  const scope = archiveScope(url.searchParams.get("year"));
  if (!scope) return noStore({ error: "เลือกปีหรือทั้งหมด" }, 400);
  const bounds = scopeBounds(scope);
  const query = () => {
    let q = db.from("game_plays").select("id,member_id,request_id,game_key,prize,tickets_before,tickets_after,points_after,created_at,member:members(name,member_code)", { count: "exact" }).eq("owner_id", actor.ownerId).lt("created_at", scope.cutoff);
    if (bounds) q = q.gte("created_at", bounds.from).lt("created_at", bounds.to);
    return q;
  };
  if (url.searchParams.get("download") !== "1") {
    const result = await query().limit(0);
    return result.error ? noStore({ error: "นับประวัติไม่สำเร็จ" }, 500) : noStore({ count: result.count || 0 });
  }
  try {
    const book = new ExcelJS.Workbook();
    book.creator = "Tammy Pet Shop";
    const sheets = new Map<string, ExcelJS.Worksheet>();
    const ids: string[] = [];
    let lastId = "";
    while (true) {
      let q = query().order("id").limit(500);
      if (lastId) q = q.gt("id", lastId);
      const result = await q;
      if (result.error) throw new Error("อ่านประวัติไม่สำเร็จ");
      const rows = result.data || [];
      if (!rows.length) break;
      for (const row of rows) {
        const local = new Date(Date.parse(row.created_at) + 7 * 3600000).toISOString();
        const month = local.slice(0, 7);
        let sheet = sheets.get(month);
        if (!sheet) {
          sheet = book.addWorksheet(month, { views: [{ state: "frozen", ySplit: 1 }] });
          sheet.columns = ["รหัสรายการ", "รหัสสมาชิก", "ชื่อสมาชิก", "รหัสคำขอ", "เกม", "ประเภทรางวัล", "รางวัล", "ตั๋วก่อน", "ตั๋วหลัง", "แต้มหลัง", "วันที่ (เวลาไทย)", "รายละเอียดรางวัล"].map((header, index) => ({ header, key: String(index), width: index === 2 ? 30 : 22 }));
          sheet.getRow(1).font = { bold: true };
          sheets.set(month, sheet);
        }
        const member = (Array.isArray(row.member) ? row.member[0] : row.member) as { name?: string } | null;
        // Export reward terms as text; embedded images are not history data and can exceed Excel cell limits.
        const { image: _image, ...terms } = row.prize || {};
        sheet.addRow([row.id, row.member_id, member?.name || "", row.request_id, row.game_key, row.prize?.kind, row.prize?.title, row.tickets_before, row.tickets_after, row.points_after, local.slice(0, 19).replace("T", " "), JSON.stringify(terms)]);
        ids.push(row.id);
      }
      lastId = rows[rows.length - 1].id;
      if (ids.length > 100000) throw new Error("ข้อมูลมากเกินไป กรุณาแยกสำรองทีละปี");
    }
    if (!ids.length) { const sheet = book.addWorksheet("ไม่มีรายการ"); sheet.addRow(["ไม่มีประวัติการเล่นในช่วงที่เลือก"]); }
    const receipt = ids.length ? signArchive({ ...scope, owner: actor.ownerId, actor: actor.userId, count: ids.length, fingerprint: createHash("md5").update(ids.join(",")).digest("hex"), expires: Date.now() + 3600000 }) : "";
    const data = await book.xlsx.writeBuffer();
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="tammy-game-history-${scope.year || "all"}.xlsx"`, "Cache-Control": "no-store", "X-Archive-Receipt": receipt, "X-Archive-Count": String(ids.length) } });
  } catch (error) { return noStore({ error: (error as Error).message }, 500); }
}
export async function DELETE(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อม" }, 503);
  let body;
  try { body = await request.json(); } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  const receipt = verifyArchive(body.receipt);
  if (!receipt || receipt.owner !== actor.ownerId || receipt.actor !== actor.userId || body.confirmation !== "ล้างประวัติ") return noStore({ error: "กรุณาสำรองข้อมูลใหม่และยืนยันการล้าง" }, 400);
  const result = await db.rpc("clear_game_history", { p_owner: actor.ownerId, p_actor: actor.userId, p_year: receipt.year, p_cutoff: receipt.cutoff, p_count: receipt.count, p_fingerprint: receipt.fingerprint });
  if (result.error) return noStore({ error: result.error.message.includes("ARCHIVE_CHANGED") ? "ประวัติเปลี่ยนแล้ว กรุณาสำรองใหม่ก่อนล้าง" : "ล้างประวัติไม่สำเร็จ ตรวจว่าติดตั้ง migration แล้ว" }, 409);
  return noStore(result.data);
}
