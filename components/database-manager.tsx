"use client";

import { CheckCircle2, Database, Menu, Plus, RefreshCw, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Sidebar } from "./sidebar";

type Sheet = "members" | "pets" | "points_transactions";
type Cell = string | number | boolean | null;
type Row = Record<string, Cell | string[]>;

const sheetLabels: Record<Sheet, string> = { members: "สมาชิก", pets: "สัตว์เลี้ยง", points_transactions: "ประวัติแต้ม" };
const demo: Record<Sheet, Row[]> = {
  members: [
    { member_code: "TM00001", name: "คุณมะลิ จันทร์สุข", phone: "089-456-7890", email: "mali.jun@gmail.com", level: "Silver", points: 680, spending: 12340, status: "active", tags: ["ลูกค้าประจำ", "รักแมว"] },
    { member_code: "TM00002", name: "คุณศิริพร กมลดี", phone: "081-234-5678", email: "siriporn@email.com", level: "Gold", points: 1250, spending: 24560, status: "active", tags: ["ลูกค้าประจำ"] },
    { member_code: "TM00003", name: "คุณเพ็ญพล อิงอุ่น", phone: "086-778-2211", email: "penpol@email.com", level: "Member", points: 90, spending: 1260, status: "inactive", tags: ["ต้องติดตาม"] },
  ],
  pets: [
    { member_code: "TM00001", name: "น้องโมจิ", species: "cat", breed: "Scottish Fold", sex: "male", birth_date: "2021-03-12", allergies: ["อาหารทะเล"], health_note: "ตรวจสุขภาพประจำปี" },
    { member_code: "TM00001", name: "น้องถั่ว", species: "dog", breed: "Chihuahua", sex: "female", birth_date: "2022-08-05", allergies: [], health_note: "สุขภาพแข็งแรง" },
    { member_code: "TM00002", name: "น้องข้าว", species: "cat", breed: "ไทย", sex: "female", birth_date: "2020-11-19", allergies: [], health_note: "" },
  ],
  points_transactions: [
    { created_at: "2026-09-18 14:32", member_code: "TM00001", member_name: "คุณมะลิ จันทร์สุข", sale_amount: 500, points_delta: 50, transaction_type: "earn", note: "ซื้ออาหารแมว" },
    { created_at: "2026-09-17 13:05", member_code: "TM00002", member_name: "คุณศิริพร กมลดี", sale_amount: 1200, points_delta: 120, transaction_type: "earn", note: "ซื้อสินค้าในร้าน" },
  ],
};

const columns: Record<Sheet, Array<{ key: string; label: string }>> = {
  members: [{ key: "member_code", label: "รหัส" }, { key: "name", label: "ชื่อสมาชิก" }, { key: "phone", label: "เบอร์โทร" }, { key: "email", label: "อีเมล" }, { key: "level", label: "ระดับ" }, { key: "points", label: "แต้ม" }, { key: "spending", label: "ยอดซื้อสะสม" }, { key: "status", label: "สถานะ" }, { key: "tags", label: "แท็ก" }],
  pets: [{ key: "member_code", label: "รหัสสมาชิก" }, { key: "name", label: "ชื่อสัตว์เลี้ยง" }, { key: "species", label: "ประเภท" }, { key: "breed", label: "สายพันธุ์" }, { key: "sex", label: "เพศ" }, { key: "birth_date", label: "วันเกิด" }, { key: "allergies", label: "อาการแพ้" }, { key: "health_note", label: "บันทึกสุขภาพ" }],
  points_transactions: [{ key: "created_at", label: "วันที่" }, { key: "member_code", label: "รหัสสมาชิก" }, { key: "member_name", label: "สมาชิก" }, { key: "sale_amount", label: "ยอดซื้อ" }, { key: "points_delta", label: "แต้ม" }, { key: "transaction_type", label: "ประเภทรายการ" }, { key: "note", label: "หมายเหตุ" }],
};

export function DatabaseManager() {
  const [activeSheet, setActiveSheet] = useState<Sheet>("members");
  const [rows, setRows] = useState<Record<Sheet, Row[]>>(demo);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"demo" | "supabase">("demo");
  const [loading, setLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  async function refresh() {
    if (!supabase) return;
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSource("demo"); setLoading(false); return; }
    const [members, pets, transactions] = await Promise.all([
      supabase.from("members").select("member_code,name,phone,email,level,points,spending,status,tags").order("created_at"),
      supabase.from("pets").select("member_id,name,species,breed,sex,birth_date,allergies,health_note").order("created_at"),
      supabase.from("points_transactions").select("created_at,member_id,sale_amount,points_delta,transaction_type,note").order("created_at", { ascending: false }),
    ]);
    if (!members.error && !pets.error && !transactions.error) {
      setRows({ members: members.data as Row[], pets: pets.data as Row[], points_transactions: transactions.data as Row[] });
      setSource("supabase");
    }
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);
  const visibleRows = useMemo(() => rows[activeSheet].filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [activeSheet, query, rows]);

  return <div className="app-shell database-page"><div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} /><div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/database" /></div><main className="main-content"><header className="page-header"><button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button><div className="title-icon"><Database /></div><div className="heading-copy"><h1>ฐานข้อมูล</h1><p>ดูข้อมูลแต่ละประเภทแยกเป็นชีต อ่านง่ายและไม่ปะปนกัน</p></div><div className="header-actions"><span className={`database-source ${source}`}><CheckCircle2 /> {source === "supabase" ? "เชื่อมต่อ Supabase" : isSupabaseConfigured ? "ข้อมูลตัวอย่าง • รอเข้าสู่ระบบ" : "ยังไม่ได้ตั้งค่า Supabase"}</span><button className="button outline" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> รีเฟรช</button></div></header>
    <section className="panel sheet-panel"><div className="sheet-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`ค้นหาในชีต${sheetLabels[activeSheet]}`} /></label><span>{visibleRows.length} แถว</span><button type="button"><Plus /> เพิ่มแถว</button></div><div className="sheet-scroll"><div className="sheet-grid" style={{ gridTemplateColumns: `52px repeat(${columns[activeSheet].length}, minmax(140px, 1fr))` }}><span className="sheet-corner">#</span>{columns[activeSheet].map((column, index) => <span className="sheet-column" key={column.key}>{String.fromCharCode(65 + index)} · {column.label}</span>)}{visibleRows.flatMap((row, rowIndex) => [<span className="sheet-row-number" key={`n-${rowIndex}`}>{rowIndex + 1}</span>, ...columns[activeSheet].map((column) => <span className="sheet-cell" key={`${rowIndex}-${column.key}`}>{formatCell(row[column.key])}</span>)])}</div></div><nav className="sheet-tabs" aria-label="ตารางฐานข้อมูล"><button className="sheet-add" type="button" aria-label="เพิ่มชีต"><Plus /></button>{(Object.keys(sheetLabels) as Sheet[]).map((sheet) => <button type="button" key={sheet} className={activeSheet === sheet ? "active" : ""} onClick={() => { setActiveSheet(sheet); setQuery(""); }}><Table2 /> {sheetLabels[sheet]} <small>{rows[sheet].length}</small></button>)}</nav></section></main></div>;
}

function formatCell(value: Cell | string[] | undefined) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "–";
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}
