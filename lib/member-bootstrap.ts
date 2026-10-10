import { loadMemberCatalog, clearMemberCatalog } from "./customer-catalog";
import { loadMemberAccount, clearMemberAccount } from "./customer-account-data";
import { clearCouponQr } from "./customer-qr";
export async function prepareMemberData(idToken?:string,accessToken?:string){
 await Promise.all([loadMemberCatalog(idToken,accessToken),loadMemberAccount(idToken,accessToken)]);
}
export function prefetchMemberData(idToken?:string,accessToken?:string){
 void Promise.allSettled([loadMemberCatalog(idToken,accessToken),loadMemberAccount(idToken,accessToken)]);
}
export function clearMemberDisplayData(){clearMemberCatalog();clearMemberAccount();clearCouponQr();}
