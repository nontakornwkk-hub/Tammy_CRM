export type StoreLocation = { address: string; latitude: string; longitude: string };
export const emptyStoreLocation: StoreLocation = { address:"",latitude:"",longitude:"" };
export function normalizeStoreLocation(value:unknown):StoreLocation {
  const source=value&&typeof value==="object"?value as Partial<StoreLocation>:{};
  return {address:typeof source.address==="string"?source.address.slice(0,500):"",latitude:typeof source.latitude==="string"?source.latitude:"",longitude:typeof source.longitude==="string"?source.longitude:""};
}
export function storeCoordinates(location:StoreLocation):[number,number]|null {
  if(!location.latitude.trim()||!location.longitude.trim())return null;
  const lat=Number(location.latitude),lng=Number(location.longitude);
  return Number.isFinite(lat)&&Math.abs(lat)<=85&&Number.isFinite(lng)&&Math.abs(lng)<=180?[lat,lng]:null;
}
export function storeDirections(location:StoreLocation) {
  const point=storeCoordinates(location);
  return point?`https://www.google.com/maps/dir/?${new URLSearchParams({api:"1",destination:point.join(",")})}`:null;
}
export function googleMapEmbed(location:StoreLocation):string|null {
  const point=storeCoordinates(location);if(!point)return null;
  return `https://www.google.com/maps?${new URLSearchParams({q:point.join(","),z:"16",output:"embed",hl:"th"})}`;
}
export function parseGoogleCoordinates(value:string):[number,number]|null {
  const text=value.trim();
  let pair=text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if(!pair){
    try{const url=new URL(text);if(url.protocol!=="https:"||!/(^|\.)google\.[a-z.]+$/.test(url.hostname)||!url.pathname.startsWith("/maps"))return null;
      pair=url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||(url.searchParams.get("q")||url.searchParams.get("query")||"").match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    }catch{return null;}
  }
  return pair?storeCoordinates({address:"",latitude:pair[1],longitude:pair[2]}):null;
}
