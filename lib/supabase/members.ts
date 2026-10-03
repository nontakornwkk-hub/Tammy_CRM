import { memberColumns } from "./member-columns";
import type { MemberRow } from "@/lib/database.types";
import { supabase } from "./client";
import { crmOwnerId } from "./crm-data";

export async function loadMembers() {
  if (!supabase) return { mode: "demo" as const, members: null, error: null };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { mode: "demo" as const, members: null, error: null };
  const { data, error } = await supabase.from("members").select(memberColumns).order("member_number", { ascending: true }).order("created_at", { ascending: true });
  return { mode: "supabase" as const, members: data, error };
}

export async function createMember(input: Pick<MemberRow, "name" | "phone" | "email"> & { petName?: string; birthDate?: string | null }) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: new Error("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูลจริง") };
  const ownerId = crmOwnerId();
  if (!ownerId) return { data: null, error: new Error("ยังไม่พบสิทธิ์ของร้าน") };
  const placeholderCode = `TM${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
  const { data, error } = await supabase.from("members").insert({ owner_id: ownerId, member_code: placeholderCode, name: input.name, phone: input.phone, email: input.email, birth_date: input.birthDate || null, level: "Member", points: 0, spending: 0, last_visit: new Date().toISOString().slice(0, 10), status: "active", newsletter_opt_in: false, notes: "", tags: ["สมาชิกใหม่"] }).select(memberColumns).single();
  if (error || !data) return { data, error };
  const fresh = await supabase.from("members").select(memberColumns).eq("id", data.id).single();
  const member = fresh.data ?? data;
  if (!input.petName) return { data: member, error: fresh.error };
  const { error: petError } = await supabase.from("pets").insert({ owner_id: ownerId, member_id: data.id, name: input.petName, species: "other", breed: null, sex: "unknown", birth_date: null, allergies: [], health_note: "" });
  return { data: member, error: fresh.error ?? petError };
}
