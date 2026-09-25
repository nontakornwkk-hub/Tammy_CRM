"use client";

import {
  Armchair,
  ChevronLeft,
  ChevronRight,
  Gift,
  ImageIcon,
  Menu,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Sidebar } from "./sidebar";
import { DateRangePicker } from "./date-range-picker";

type RewardType = "ของรางวัล" | "คูปอง" | "ข่าวสาร";
type Reward = {
  id: number;
  title: string;
  description: string;
  type: RewardType;
  points: number;
  stock: number | null;
  active: boolean;
  icon: "food" | "snack" | "bed" | "toy" | "scratcher" | "bowl";
  tint: string;
};

const initialRewards: Reward[] = [
  { id: 1, title: "อาหารสัตว์ลด 10%", description: "รับส่วนลด 10% สำหรับอาหารสัตว์ทุกยี่ห้อ", type: "คูปอง", points: 300, stock: null, active: true, icon: "food", tint: "#ffe5df" },
  { id: 2, title: "ขนมแมวเลีย 4 ชิ้น", description: "ขนมแมวเลีย รสต่างๆ คละรส 4 ชิ้น", type: "ของรางวัล", points: 500, stock: 24, active: true, icon: "snack", tint: "#fff0d7" },
  { id: 3, title: "ที่นอนนุ่มสำหรับแมว", description: "ที่นอนทรงกลม นุ่มสบาย ขนาด M", type: "ของรางวัล", points: 800, stock: 10, active: true, icon: "bed", tint: "#f0e9df" },
  { id: 4, title: "ของเล่นลูกบอล", description: "ของเล่นลูกบอลสีสันสดใส แพ็ค 3 ชิ้น", type: "ของรางวัล", points: 350, stock: 50, active: true, icon: "toy", tint: "#eaf8ff" },
  { id: 5, title: "ที่ลับเล็บแมว", description: "ที่ลับเล็บกระดาษแข็ง รุ่นมาตรฐาน", type: "ของรางวัล", points: 600, stock: 15, active: false, icon: "scratcher", tint: "#eee4d4" },
  { id: 6, title: "ชามอาหารแมว", description: "ชามอาหารสแตนเลส พร้อมฐานกันลื่น", type: "ของรางวัล", points: 450, stock: 30, active: true, icon: "bowl", tint: "#ffe8eb" },
  { id: 7, title: "สุขสันต์วันแมวโลก", description: "พบกับกิจกรรมและสิทธิพิเศษตลอดเดือนนี้", type: "ข่าวสาร", points: 0, stock: null, active: true, icon: "toy", tint: "#e8f5ff" },
];

const typeStyles: Record<RewardType, string> = {
  "ของรางวัล": "reward",
  "คูปอง": "coupon",
  "ข่าวสาร": "news",
};

function RewardArtwork({ item, large = false }: { item: Reward; large?: boolean }) {
  const icons = { food: Package, snack: Sparkles, bed: Armchair, toy: Gift, scratcher: Tag, bowl: Package };
  const Icon = icons[item.icon];
  return <span className={`reward-art${large ? " large" : ""}`} style={{ background: item.tint }}><Icon /></span>;
}

function Switch({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return <button type="button" className={`toggle${checked ? " on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={onClick}><span /></button>;
}

export function RewardsManager() {
  const [items, setItems] = useState(initialRewards);
  const [selectedId, setSelectedId] = useState(2);
  const [tab, setTab] = useState<RewardType>("ของรางวัล");
  const [filter, setFilter] = useState<"ทั้งหมด" | "เปิดใช้งาน" | "แบบร่าง">("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [startDate, setStartDate] = useState("2025-04-01");
  const [endDate, setEndDate] = useState("2025-06-30");
  const [imageName, setImageName] = useState("");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const [draft, setDraft] = useState(selected);

  const visible = useMemo(() => items.filter((item) => {
    const tabMatch = tab === "ของรางวัล" ? item.type !== "ข่าวสาร" : item.type === tab;
    const filterMatch = filter === "ทั้งหมด" || (filter === "เปิดใช้งาน" ? item.active : !item.active);
    const searchMatch = `${item.title} ${item.description}`.includes(search.trim());
    return tabMatch && filterMatch && searchMatch;
  }), [filter, items, search, tab]);

  function choose(item: Reward) {
    setSelectedId(item.id);
    setDraft(item);
    setSaved(false);
  }

  function updateActive(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
    if (id === selectedId) setDraft((current) => ({ ...current, active: !current.active }));
  }

  function addItem() {
    const next: Reward = { id: Date.now(), title: "รายการใหม่", description: "เพิ่มรายละเอียดรายการ", type: tab, points: 100, stock: 10, active: true, icon: "toy", tint: "#fff0ed" };
    setItems((current) => [next, ...current]);
    choose(next);
  }

  function save() {
    setItems((current) => current.map((item) => item.id === draft.id ? draft : item));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function remove() {
    const remaining = items.filter((item) => item.id !== selectedId);
    setItems(remaining);
    if (remaining[0]) choose(remaining[0]);
  }

  return (
    <div className="app-shell rewards-page">
      <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
      <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/rewards" /></div>
      <main className="main-content">
        <header className="page-header rewards-header">
          <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
          <div className="title-icon"><Gift /></div>
          <div className="heading-copy"><h1>คูปอง ของรางวัล และข่าวสาร</h1><p>สร้าง จัดการ และเลือกเนื้อหาที่ลูกค้าจะเห็น</p></div>
          <div className="header-actions"><span className="ready"><i /> พร้อมใช้งาน</span><button className="button primary" type="button" onClick={addItem}><Plus size={20} /> เพิ่มรายการ</button></div>
        </header>

        <nav className="reward-tabs" aria-label="ประเภทเนื้อหา">
          {([
            ["ของรางวัล", Gift],
            ["คูปอง", Tag],
            ["ข่าวสาร", Megaphone],
          ] as const).map(([name, Icon]) => <button type="button" key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><Icon /> {name}</button>)}
        </nav>

        <div className="reward-workspace">
          <section className="panel reward-list-panel">
            <div className="reward-list-heading"><h2>รายการทั้งหมด <small>({visible.length} รายการ)</small></h2></div>
            <div className="reward-tools">
              <label className="search-box"><Search size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อรายการ, หมวดหมู่ ..." /></label>
              <div className="filter-pills">{(["ทั้งหมด", "เปิดใช้งาน", "แบบร่าง"] as const).map((name) => <button type="button" key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>{name}</button>)}</div>
            </div>
            <div className="reward-table">
              <div className="reward-table-head"><span>รายการ</span><span>หมวดหมู่</span><span>แต้มที่ใช้ / วันที่เผยแพร่</span><span>คงเหลือ</span><span>สถานะ</span><span>จัดการ</span></div>
              <div>
                {visible.map((item) => <article key={item.id} className={`reward-row${item.id === selectedId ? " selected" : ""}`} onClick={() => choose(item)}>
                  <RewardArtwork item={item} />
                  <div className="reward-copy"><strong>{item.title}</strong><span>{item.description}</span></div>
                  <span className={`type-badge ${typeStyles[item.type]}`}>{item.type}</span>
                  <strong className="points-value">{item.points.toLocaleString()} แต้ม</strong>
                  <span>{item.stock === null ? "ไม่จำกัด" : `${item.stock} ชิ้น`}</span>
                  <Switch checked={item.active} onClick={() => updateActive(item.id)} label={`สถานะ ${item.title}`} />
                  <button className="edit-button" type="button" onClick={(event) => { event.stopPropagation(); choose(item); }}><Pencil size={16} /> แก้ไข</button>
                </article>)}
              </div>
            </div>
            <div className="panel-footer"><span>แสดง 1 - {visible.length} จาก {visible.length} รายการ</span><span className="pagination"><button type="button"><ChevronLeft size={15} /></button><button type="button" className="current">1</button><button type="button"><ChevronRight size={15} /></button></span></div>
          </section>

          <section className="panel reward-editor">
            <div className="reward-editor-title"><h2>แก้ไขของรางวัล</h2></div>
            <div className="reward-form">
              <div className="reward-form-top">
                <div className="reward-image"><RewardArtwork item={draft} large /><label className="image-upload"><ImageIcon size={16} /> {imageName || "เปลี่ยนรูปภาพ"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageName(event.target.files?.[0]?.name ?? "")} /></label></div>
                <div className="field"><label>ชื่อรายการ <em>*</em></label><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div>
                <div className="field"><label>หมวดหมู่ <em>*</em></label><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as RewardType })}><option>ของรางวัล</option><option>คูปอง</option><option>ข่าวสาร</option></select></div>
              </div>
              <div className="field"><label>คำอธิบาย <em>*</em></label><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div>
              <div className="two-fields">
                <div className="field suffix-field"><label>แต้มที่ใช้แลก <em>*</em></label><input type="number" value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /><span>แต้ม</span></div>
                <div className="field suffix-field"><label>จำนวนคงเหลือ <em>*</em></label><input type="number" value={draft.stock ?? 0} onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })} /><span>ชิ้น</span></div>
              </div>
              <div className="field"><label>ช่วงวันที่ใช้งาน <em>*</em></label><DateRangePicker start={startDate} end={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} label="ช่วงวันที่ใช้งานของรางวัล" /></div>
              <div className="field"><label>เงื่อนไขการใช้</label><textarea className="terms" value={"1. ใช้คะแนนแลกรับได้ 1 สิทธิ์ ต่อ 1 สมาชิก\n2. สินค้ามีจำนวนจำกัด\n3. ไม่สามารถแลกเป็นเงินสดได้"} readOnly /></div>
              <div className="reward-switches"><label>เปิดใช้งาน <Switch checked={draft.active} onClick={() => setDraft({ ...draft, active: !draft.active })} label="เปิดใช้งาน" /></label><label>แสดงใน Popup หลัง Login <Switch checked={popupEnabled} onClick={() => setPopupEnabled((current) => !current)} label="แสดงใน Popup" /></label><label>ลำดับ Popup <input type="number" min="1" defaultValue="2" /></label></div>
            </div>
            <div className="editor-actions"><button className="delete-button" type="button" onClick={remove}><Trash2 size={18} /> ลบรายการ</button><button className={`save-button${saved ? " saved" : ""}`} type="button" onClick={save}>{saved ? <Gift size={18} /> : <Save size={18} />} {saved ? "บันทึกแล้ว" : "บันทึกการเปลี่ยนแปลง"}</button></div>
          </section>
        </div>
      </main>
    </div>
  );
}
