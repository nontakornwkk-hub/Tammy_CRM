import "server-only";
import {randomUUID} from "node:crypto";
type Batch={id:string;limit:number;expires:number};
type Receipt={memberId:string;amount:number;batch:Batch};
const memory=globalThis as typeof globalThis&{tammyTestTickets?:Map<string,Batch>;tammyTestReceipts?:Map<string,Receipt>};
const batches=memory.tammyTestTickets??=new Map<string,Batch>();const receipts=memory.tammyTestReceipts??=new Map<string,Receipt>();
function clean(){const now=Date.now();for(const[k,v]of batches)if(v.expires<=now)batches.delete(k);for(const[k,v]of receipts)if(v.batch.expires<=now)receipts.delete(k);}
export function getTestTickets(owner:string,member:string){clean();return batches.get(`${owner}:${member}`)||null;}
export function giveTestTickets(owner:string,member:string,request:string,amount:number){clean();const key=`${owner}:${request}`,old=receipts.get(key);if(old){if(old.memberId!==member||old.amount!==amount)throw Error("รหัสคำขอนี้ถูกใช้แล้ว");return getTestTickets(owner,member)||old.batch;}let batch=getTestTickets(owner,member);if(batch){if(batch.limit+amount>10000)throw Error("สิทธิ์ทดสอบรวมสูงสุด 10,000 ครั้งต่อรอบ");batch={...batch,limit:batch.limit+amount};}else batch={id:randomUUID(),limit:amount,expires:Date.now()+3600000};batches.set(`${owner}:${member}`,batch);receipts.set(key,{memberId:member,amount,batch});return batch;}
