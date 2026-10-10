// Strip formatting after autofill, without truncating the original phone number.
export function normalizeThaiPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^66[1-9]\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0066[1-9]\d{8}$/.test(digits)) return `0${digits.slice(4)}`;
  return digits;
}
