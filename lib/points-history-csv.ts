export const historyCsvHeader="ลำดับ,วันที่และเวลา,รหัสสมาชิก,ชื่อสมาชิก,ชื่อ LINE,ประเภทรายการ,ยอดซื้อ (บาท),แต้ม,รายละเอียด";
export type HistoryExportRow={history_key:string;created_at:string;member_code:string|null;member_name:string|null;line_name:string|null;entry_type:string;sale_amount:number;points_delta:number;description:string};
const dateFormat=new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
function csvCell(value:unknown){const raw=String(value??""),safe=/^[\s]*[=+\-@\t\r]/.test(raw)?`'${raw}`:raw;return `"${safe.replaceAll('"','""')}"`;}
export function historyCsvRow(row:HistoryExportRow,index:number){
 const type=({earn:"ให้แต้ม",redeem:"ใช้แต้ม",adjustment:"ปรับแต้ม",coupon:"ใช้คูปอง",reward:"แลกของรางวัล",audit:"บันทึกการทำงาน (Audit log)"} as Record<string,string>)[row.entry_type]||row.entry_type;
 return [index,dateFormat.format(new Date(row.created_at)),row.member_code||"",row.member_name||(row.entry_type==="audit"?"ระบบ / แอดมิน":"สมาชิกที่ลบบัญชีแล้ว"),row.line_name||"",type,row.sale_amount,row.points_delta,row.description].map(csvCell).join(",");
}
