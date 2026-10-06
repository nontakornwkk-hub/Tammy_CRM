export function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export function historyRange(input:{from?:unknown;to?:unknown;year?:unknown;snapshot?:unknown}) {
  const today=bangkokToday(),year=Number(input.year);
  const from=typeof input.from==="string"?input.from:`${year}-01-01`;
  const to=typeof input.to==="string"?input.to:year===Number(today.slice(0,4))?today:`${year}-12-31`;
  const valid=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
  if(!valid(from)||!valid(to)||from<"2020-01-01"||from>to||to>today)return null;
  const snapshot=typeof input.snapshot==="string"?input.snapshot:new Date().toISOString();
  if(!Number.isFinite(Date.parse(snapshot))||Date.parse(snapshot)>Date.now()+1000)return null;
  return {from,to,snapshot,fromInstant:new Date(`${from}T00:00:00+07:00`).toISOString(),
    toInstant:new Date(Date.parse(`${to}T00:00:00+07:00`)+86400000).toISOString()};
}
