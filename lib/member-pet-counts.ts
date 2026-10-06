// Member profile counts are authoritative, including an explicit zero.
// Detailed pet records are only a fallback for legacy profiles without counts.
export function memberPetCounts(member:{dog_count?:number|null;cat_count?:number|null}|null,pets:{species:string}[]){
 return {dogs:member?.dog_count??pets.filter(pet=>pet.species==="dog").length,
  cats:member?.cat_count??pets.filter(pet=>pet.species==="cat").length};
}
