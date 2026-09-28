"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiLine } from "react-icons/si";
import { ArrowLeft, Check, ChevronRight, CircleHelp, Link2, Menu, MessageCircle, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck, UserRound, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { supabase } from "@/lib/supabase/client";
import { crmRole } from "@/lib/supabase/crm-data";
import { LineConnectionPanel } from "./line-connection-panel";

type Conversation = { id: string; line_user_id: string; member_id: string | null; display_name: string; picture_url: string | null; status: "new" | "open" | "closed"; assigned_to: string | null; internal_note: string; unread_count: number; last_message_at: string | null; last_message_preview: string; blocked_at: string | null };
type Message = { id: string; direction: "incoming" | "outgoing"; kind: string; body: string; send_status: string; created_at: string };
type Member = { id: string; name: string; member_code: string; phone: string | null; points: number; level: string };
type Team = { user_id: string; name: string; role: string };
type Recipient = { member_id: string; line_display_name: string | null; line_picture_url: string | null; member: Pick<Member, "id" | "name" | "member_code" | "phone"> | null };
type QuickReply = { id: string; title: string; body: string };
type Connection = { connected: boolean; source: string; channelId: string; bot: { displayName: string; basicId: string } | null; channelSecret: boolean; accessToken: boolean; membershipUrl: string; webhook: { endpoint: string; active: boolean } | null; liff: boolean; webhookTested?: boolean; message?: string };

async function lineApi<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
  return data;
}

function Avatar({ name, picture, size = 42 }: { name: string; picture?: string | null; size?: number }) {
  return <span className="linev2-avatar" style={{ width: size, height: size }}>
    {picture?.startsWith("https://") ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : <UserRound size={size * .47} />}
  </span>;
}

export function LineManager() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tab, setTab] = useState<"chat" | "connection" | "webhook">("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [team, setTeam] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickBody, setNewQuickBody] = useState("");
  const [newChat, setNewChat] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connectionForm, setConnectionForm] = useState({ channelId: "", channelSecret: "", accessToken: "", membershipUrl: "" });
  const [connecting, setConnecting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("/api/line/messaging/webhook");
  const role = crmRole();

  const loadInbox = useCallback(async (currentId: string | null, quiet = false) => {
    try {
      const params = currentId ? `?conversationId=${encodeURIComponent(currentId)}` : "";
      const data = await lineApi<{ conversations: Conversation[]; messages: Message[]; members: Member[]; team: Team[] }>(`/api/line/messaging/conversations${params}`);
      setConversations(data.conversations);
      setMessages(data.messages);
      setMembers(data.members);
      setTeam(data.team);
      if (!quiet) setError("");
    } catch (cause) { if (!quiet) setError(cause instanceof Error ? cause.message : "โหลดแชตไม่สำเร็จ"); }
    finally { if (!quiet) setLoading(false); }
  }, []);

  const loadConnection = useCallback(async () => {
    try {
      const data = await lineApi<Connection>("/api/line/messaging/connection");
      setConnection(data);
      setConnectionForm(current => ({ ...current, channelId: data.channelId || current.channelId, membershipUrl: data.membershipUrl || current.membershipUrl }));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ตรวจการเชื่อมต่อไม่สำเร็จ"); }
  }, []);

  const loadQuickReplies = useCallback(async () => {
    try { const data = await lineApi<{ replies: QuickReply[] }>("/api/line/messaging/quick-replies"); setQuickReplies(data.replies); }
    catch { /* The inbox still works if saved replies are unavailable. */ }
  }, []);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/line/messaging/webhook`);
    void loadInbox(null);
    void loadQuickReplies();
    if (role === "owner") void loadConnection();
  }, [loadInbox, loadConnection, loadQuickReplies, role]);
  useEffect(() => {
    if (tab !== "chat") return;
    const timer = window.setInterval(() => { void loadInbox(selectedId, true); }, 8000);
    return () => window.clearInterval(timer);
  }, [tab, selectedId, loadInbox]);

  const selected = conversations.find(item => item.id === selectedId) || null;
  const selectedMember = members.find(item => item.id === selected?.member_id) || null;
  const visible = useMemo(() => conversations.filter(item => `${item.display_name} ${item.last_message_preview} ${members.find(member => member.id === item.member_id)?.name || ""}`.toLowerCase().includes(search.toLowerCase())), [conversations, members, search]);

  async function openChat(id: string) {
    setSelectedId(id);
    setDraft("");
    setError("");
    await loadInbox(id);
    try {
      await lineApi("/api/line/messaging/conversations", { method: "PATCH", body: JSON.stringify({ conversationId: id, read: true }) });
      setConversations(current => current.map(item => item.id === id ? { ...item, unread_count: 0 } : item));
    } catch { /* A failed read marker should not hide the conversation. */ }
  }

  async function updateConversation(changes: Record<string, unknown>) {
    if (!selectedId) return;
    try {
      await lineApi("/api/line/messaging/conversations", { method: "PATCH", body: JSON.stringify({ conversationId: selectedId, ...changes }) });
      setConversations(current => current.map(item => item.id === selectedId ? { ...item, ...changes } as Conversation : item));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกแชตไม่สำเร็จ"); }
  }

  async function send() {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    setError("");
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    try {
      await lineApi("/api/line/messaging/send", { method: "POST", body: JSON.stringify({ conversationId: selectedId, text: draft.trim(), requestId: id }) });
      setPreview(false);
      setDraft("");
      setRequestId("");
      await loadInbox(selectedId, true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ส่งข้อความไม่สำเร็จ"); }
    finally { setSending(false); }
  }

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const data = await lineApi<Connection>("/api/line/messaging/connection", { method: "POST", body: JSON.stringify(connectionForm) });
      setConnection(data);
      setConnectionForm(current => ({ ...current, channelSecret: "", accessToken: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ"); }
    finally { setConnecting(false); }
  }

  async function startChat(recipient: Recipient) {
    setError("");
    try {
      const data = await lineApi<{ conversationId: string }>("/api/line/messaging/conversations", { method: "POST", body: JSON.stringify({ memberId: recipient.member_id }) });
      setNewChat(false);
      await openChat(data.conversationId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปิดแชตไม่สำเร็จ"); }
  }

  async function saveQuickReply() {
    try {
      const data = await lineApi<{ reply: QuickReply }>("/api/line/messaging/quick-replies", { method: "POST", body: JSON.stringify({ title: newQuickTitle, body: newQuickBody }) });
      setQuickReplies(current => [...current, data.reply]);
      setNewQuickTitle(""); setNewQuickBody(""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกคำตอบไม่สำเร็จ"); }
  }

  return <div className="app-shell linev2-page">
    {mobileMenu && <button className="sidebar-backdrop" type="button" aria-label="ปิดเมนู" onClick={() => setMobileMenu(false)} />}
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/line" /></div>
    <main className="main-content linev2-main">
      <header className="page-header linev2-header">
        <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
        <span className="linev2-mark"><SiLine /></span><div className="heading-copy"><h1>LINE</h1><p>อ่านข้อความและดูแลลูกค้าจากบัญชีร้าน</p></div>
        {role === "owner" && <span className={`linev2-status${connection?.connected ? " ready" : ""}`}><i />{connection?.connected ? `เชื่อม ${connection.bot?.displayName || "LINE"}` : "รอเชื่อมต่อ"}</span>}
      </header>
      <nav className="linev2-tabs" aria-label="หน้า LINE"><button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><MessageCircle size={17} /> แชตและส่งข้อความ</button>{role === "owner" && <><button className={tab === "connection" ? "active" : ""} onClick={() => { setTab("connection"); void loadConnection(); }}><Settings2 size={17} /> การเชื่อมต่อ</button><button className={tab === "webhook" ? "active" : ""} onClick={() => setTab("webhook")}><Link2 size={17} /> ตั้งค่า Webhook</button></>}</nav>
      {error && <div className="linev2-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="ปิด"><X size={16} /></button></div>}

      {tab === "chat" && <section className="linev2-inbox">
        <aside className={`linev2-list${selected ? " mobile-hidden" : ""}`}>
          <div className="linev2-list-head"><div><small>กล่องข้อความ</small><h2>บทสนทนา</h2></div><button type="button" title="โหลดใหม่" onClick={() => void loadInbox(selectedId)}><RefreshCw size={17} /></button>{role !== "staff" && <button type="button" title="ส่งข้อความใหม่" onClick={async () => { try { const data = await lineApi<{ recipients: Recipient[] }>("/api/line/messaging/recipients"); setRecipients(data.recipients); setNewChat(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "โหลดสมาชิกไม่สำเร็จ"); } }}><Plus size={18} /></button>}</div>
          <label className="linev2-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือข้อความ" /></label>
          <div className="linev2-conversations">{loading ? <p className="linev2-empty">กำลังโหลดแชต…</p> : visible.length === 0 ? <p className="linev2-empty">ยังไม่มีแชตจาก LINE<br />เมื่อลูกค้าทักร้าน ข้อความจะปรากฏตรงนี้</p> : visible.map(item => <button type="button" key={item.id} className={`linev2-chat-row${selectedId === item.id ? " active" : ""}`} onClick={() => void openChat(item.id)}><Avatar name={item.display_name} picture={item.picture_url} /><span><strong>{item.display_name}</strong><small>{item.last_message_preview || "เริ่มบทสนทนา"}</small></span><span className="linev2-chat-meta"><small>{item.last_message_at ? new Date(item.last_message_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : ""}</small>{item.unread_count > 0 && <b>{item.unread_count}</b>}</span></button>)}</div>
        </aside>
        <div className={`linev2-thread${!selected ? " mobile-hidden" : ""}`}>
          {!selected ? <div className="linev2-thread-empty"><MessageCircle size={38} /><h2>เลือกบทสนทนา</h2><p>อ่านและตอบลูกค้าได้จากหน้านี้</p></div> : <>
            <header className="linev2-thread-head"><button className="linev2-back" type="button" onClick={() => setSelectedId(null)} aria-label="กลับไปแชต"><ArrowLeft size={20} /></button><Avatar name={selected.display_name} picture={selected.picture_url} size={38} /><div><strong>{selected.display_name}</strong><small>{selectedMember ? `${selectedMember.member_code} · ${selectedMember.level}` : "ยังไม่ผูกสมาชิก"}</small></div><span className={`linev2-case ${selected.status}`}>{selected.status === "new" ? "ใหม่" : selected.status === "open" ? "กำลังดูแล" : "ปิดงาน"}</span></header>
            <div className="linev2-messages">{messages.length === 0 && <p className="linev2-empty">ยังไม่มีข้อความในแชตนี้</p>}{messages.map(message => <div key={message.id} className={`linev2-bubble-wrap ${message.direction}`}><div className="linev2-bubble">{message.body}</div><small>{new Date(message.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{message.direction === "outgoing" && ` · ${message.send_status === "sent" ? "LINE รับคำขอแล้ว" : message.send_status === "failed" ? "ส่งไม่สำเร็จ" : "กำลังส่ง"}`}</small></div>)}</div>
            <div className="linev2-compose"><div className="linev2-quick">{quickReplies.map(reply => <button type="button" key={reply.id} onClick={() => { setDraft(reply.body); setRequestId(""); }}>{reply.title}</button>)}</div><textarea value={draft} onChange={event => { setDraft(event.target.value); setRequestId(""); }} maxLength={5000} placeholder="พิมพ์ข้อความถึงลูกค้า…" rows={3} disabled={Boolean(selected.blocked_at)} /><div className="linev2-compose-actions"><small>{selected.blocked_at ? "ลูกค้าบล็อกบัญชีร้าน" : "ตรวจข้อความก่อนส่งไป LINE"}</small><button type="button" disabled={!draft.trim() || Boolean(selected.blocked_at)} onClick={() => { setRequestId(crypto.randomUUID()); setPreview(true); }}>ดูตัวอย่าง <ChevronRight size={17} /></button></div></div>
          </>}
        </div>
<aside className={`linev2-detail${!selected ? " mobile-hidden" : ""}`}>{selected && <><div className="linev2-detail-profile"><Avatar name={selected.display_name} picture={selected.picture_url} size={64} /><strong>{selected.display_name}</strong><small>{selectedMember ? selectedMember.name : "ยังไม่ผูกกับสมาชิก CRM"}</small></div>{selectedMember && <div className="linev2-member-mini"><span>แต้มสะสม <b>{selectedMember.points.toLocaleString()} แต้ม</b></span><span>ระดับ <b>{selectedMember.level}</b></span><span>โทรศัพท์ <b>{selectedMember.phone || "—"}</b></span></div>}<label>สถานะงาน<select value={selected.status} onChange={event => void updateConversation({ status: event.target.value })}><option value="new">ใหม่</option><option value="open">กำลังดูแล</option><option value="closed">ปิดงาน</option></select></label>{role !== "staff" && <label>มอบหมายพนักงาน<select value={selected.assigned_to || ""} onChange={event => void updateConversation({ assignedTo: event.target.value || null })}><option value="">ยังไม่มอบหมาย</option>{team.map(person => <option key={person.user_id} value={person.user_id}>{person.name}</option>)}</select></label>}<label>โน้ตภายใน<textarea key={selected.id} defaultValue={selected.internal_note} rows={4} placeholder="บันทึกสำหรับทีมงาน ไม่ส่งให้ลูกค้า" onBlur={event => { if (event.target.value !== selected.internal_note) void updateConversation({ internalNote: event.target.value }); }} /></label><p className="linev2-private"><ShieldCheck size={14} /> โน้ตนี้ลูกค้าไม่เห็น</p>{role !== "staff" && <div className="linev2-quick-manage"><strong>คำตอบสำเร็จรูป</strong><small>แตะชื่อคำตอบเหนือช่องพิมพ์เพื่อใช้งาน</small><input value={newQuickTitle} onChange={event => setNewQuickTitle(event.target.value)} maxLength={80} placeholder="ชื่อคำตอบ เช่น เวลาทำการ" /><textarea value={newQuickBody} onChange={event => setNewQuickBody(event.target.value)} maxLength={5000} rows={3} placeholder="ข้อความที่ต้องการส่ง" /><button type="button" disabled={!newQuickTitle.trim() || !newQuickBody.trim()} onClick={() => void saveQuickReply()}>+ บันทึกคำตอบ</button></div>}</>}</aside>
      </section>}

      {tab === "connection" && role === "owner" && <LineConnectionPanel />}
      {tab === "webhook" && role === "owner" && <section className="linev2-webhook-placeholder"><div className="linev2-webhook-heading"><span><Link2 size={23} /></span><div><small>เตรียมไว้สำหรับขั้นต่อไป</small><h2>ตั้งค่า LINE Webhook</h2><p>หน้านี้เป็นโครงสร้างสำหรับวางฟังก์ชัน ยังไม่มีสวิตช์ใดเปลี่ยนการรับข้อความจริง</p></div></div><div className="linev2-webhook-grid"><article><strong>สถานะและ URL</strong><p>สถานะการรับข้อความ, URL HTTPS และการตรวจล่าสุด</p></article><article><strong>เหตุการณ์ที่รับ</strong><p>ข้อความ, การติดตาม/เลิกติดตาม และการกดเมนู</p></article><article><strong>การตอบและส่งต่อ</strong><p>ข้อความต้อนรับ, คำตอบอัตโนมัติ และส่งต่อพนักงาน</p></article><article><strong>บันทึกและแจ้งเตือน</strong><p>ข้อผิดพลาด, การส่งซ้ำ และแจ้งเตือนเมื่อรับข้อความไม่ได้</p></article></div></section>}
    </main>

    {preview && selected && <div className="linev2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreview(false); }}><section className="linev2-modal" role="dialog" aria-modal="true" aria-label="ดูตัวอย่างข้อความก่อนส่ง"><header><div><small>ดูตัวอย่างก่อนส่ง</small><h2>ข้อความถึง {selected.display_name}</h2></div><button type="button" onClick={() => setPreview(false)} aria-label="ปิด"><X size={19} /></button></header><div className="linev2-preview-phone"><div className="linev2-preview-title"><Avatar name={selected.display_name} picture={selected.picture_url} size={30} />{selected.display_name}</div><div className="linev2-preview-bubble">{draft.trim()}</div></div><p>ระบบจะส่งข้อความนี้ผ่าน LINE และบันทึกในบทสนทนา</p><footer><button type="button" onClick={() => setPreview(false)}>กลับไปแก้ไข</button><button type="button" disabled={sending} onClick={() => void send()}><Send size={16} /> {sending ? "กำลังส่ง…" : "ยืนยันส่งข้อความ"}</button></footer></section></div>}
    {newChat && <div className="linev2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setNewChat(false); }}><section className="linev2-modal" role="dialog" aria-modal="true" aria-label="เริ่มแชตใหม่"><header><div><small>ส่งข้อความใหม่</small><h2>เลือกสมาชิกที่ผูก LINE</h2></div><button type="button" onClick={() => setNewChat(false)} aria-label="ปิด"><X size={19} /></button></header><label className="linev2-search"><Search size={17} /><input value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสสมาชิก" /></label><div className="linev2-recipient-list">{recipients.filter(item => `${item.member?.name || ""} ${item.line_display_name || ""} ${item.member?.member_code || ""}`.toLowerCase().includes(recipientSearch.toLowerCase())).map(item => <button key={item.member_id} type="button" onClick={() => void startChat(item)}><Avatar name={item.line_display_name || item.member?.name || "LINE"} picture={item.line_picture_url} /><span><strong>{item.member?.name || item.line_display_name || "สมาชิก"}</strong><small>{item.member?.member_code} · {item.line_display_name || "LINE"}</small></span><ChevronRight size={16} /></button>)}{recipients.length === 0 && <p className="linev2-empty">ยังไม่มีสมาชิกที่ผูก LINE</p>}</div></section></div>}
  </div>;
}
