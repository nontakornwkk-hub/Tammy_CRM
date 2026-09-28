type AuthSettings = { external?: { google?: boolean } };

export async function googleProviderEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("ยังไม่ได้ตั้งค่า Supabase");

  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("ตรวจสอบการตั้งค่า Google ไม่สำเร็จ");
  const settings = await response.json() as AuthSettings;
  return settings.external?.google === true;
}
