/** Stable colour and sibling shapes survive every rich-asteroid split. */
export function paintedRockName(id:number,size:number,family:number,rich=false):string {
  const fam=['ochre','lavender','teal'][Math.min(2,Math.max(0,family))];
  const stage=['parent','medium','small'][Math.min(2,Math.max(0,size))];
  const name=stage==='parent'?`${fam}-parent`:`${fam}-${stage}-${(id%2)+1}`;
  return rich?`rich-${name}`:name;
}
