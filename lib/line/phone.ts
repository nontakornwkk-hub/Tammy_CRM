export function thaiPhoneToE164(phone: string) {
  return /^0\d{9}$/.test(phone) ? `+66${phone.slice(1)}` : null;
}

export function e164ToThaiPhone(phone: string) {
  return /^\+66\d{9}$/.test(phone) ? `0${phone.slice(3)}` : null;
}
