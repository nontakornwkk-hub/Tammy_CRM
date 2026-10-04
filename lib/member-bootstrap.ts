import { loadMemberCatalog, clearMemberCatalog } from "./customer-catalog";
import { loadMemberGames, clearMemberGames } from "./games/client";
import { loadMemberAccount, clearMemberAccount } from "./customer-account-data";
import { clearCouponQr } from "./customer-qr";
let artworkWarmed=false;
export function warmGameArtwork(){if(typeof window==="undefined"||artworkWarmed)return;artworkWarmed=true;
 for(const name of ["shop","frame","pets","icons","title"]){const image=new Image();image.src=`/assets/games/reference-art/${name}.webp`;void image.decode().catch(()=>{});}
}
export function prefetchMemberData(idToken?:string,accessToken?:string){warmGameArtwork();
 void Promise.allSettled([loadMemberCatalog(idToken,accessToken),loadMemberGames(idToken,accessToken),loadMemberAccount(idToken,accessToken)]);
}
export function clearMemberDisplayData(){clearMemberCatalog();clearMemberGames();clearMemberAccount();clearCouponQr();}
