export const PASTEL_PRIZE_COLORS = ["#bcd8fa","#bfe9d7","#f8d3b0","#d7c8f3","#f4bfd5","#bce9eb","#efe3ad","#cddcb5","#c7cdf4","#edc9bb","#ddc8df","#aedae7","#e6d7c1","#d2e6f0","#ebcdd0","#d9e6a3"];
export function randomPrizeColors(count: number, used: string[] = []) {
  const available=PASTEL_PRIZE_COLORS.filter(c=>!used.includes(c.toLowerCase()));
  for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
  return available.slice(0,count);
}
