import type { MemberRow } from "@/lib/database.types";
import { supabase } from "./client";

export async function loadMembers() {
  if (!supabase) return { mode: "demo" as const, members: null, error: null };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { mode: "demo" as const, members: null, error: null };
  const { data, error } = await supabase.from("members").select("*").order("created_at", { ascending: false });
  return { mode: "supabase" as const, members: data, error };
}

export async function createMember(input: Pick<MemberRow, "name" | "phone" | "email"> & { petName?: string }) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { data: null, error: new Error("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูลจริง") };
  const { data, error } = await supabase.from("members").insert({ member_code: `TM${Date.now().toString().slice(-8)}`, name: input.name, phone: input.phone, email: input.email, level: "Member", points: 0, spending: 0, last_visit: new Date().toISOString().slice(0, 10), status: "active", newsletter_opt_in: false, notes: "", tags: ["สมาชิกใหม่"] }).select().single();
  if (error || !data || !input.petName) return { data, error };
  const { error: petError } = await supabase.from("pets").insert({ member_id: data.id, name: input.petName, species: "other", breed: null, sex: "unknown", birth_date: null, allergies: [], health_note: "" });
  return { data, error: petError };
}
