import { loadMemberCatalog, clearMemberCatalog, seedMemberCatalog } from "./customer-catalog";
import { loadMemberAccount, clearMemberAccount, seedMemberAccount, type AccountData } from "./customer-account-data";
import { clearCouponQr } from "./customer-qr";
export async function prepareMemberData(idToken?:string,accessToken?:string){
 await Promise.all([loadMemberCatalog(idToken,accessToken),loadMemberAccount(idToken,accessToken)]);
}
export type MemberBootstrap = { catalog: Record<string, unknown>; account: AccountData };
// Called only by the active login attempt after the server verified LINE and membership.
export function seedMemberData(data: MemberBootstrap, idToken?: string, accessToken?: string) {
 seedMemberCatalog(data.catalog,idToken,accessToken);
 seedMemberAccount(data.account,idToken,accessToken);
}
export function prefetchMemberData(idToken?:string,accessToken?:string){
 void Promise.allSettled([loadMemberCatalog(idToken,accessToken),loadMemberAccount(idToken,accessToken)]);
}
export function clearMemberDisplayData(){clearMemberCatalog();clearMemberAccount();clearCouponQr();}
