// Williams balanced Latin square: each item occurs in each position once and
// each ordered pair occurs consecutively once across the four rows.
export const LATIN_SQUARE = [[0,1,3,2],[1,2,0,3],[2,3,1,0],[3,0,2,1]];
export function makeAssignment(allocation,items) {
  if(!Number.isSafeInteger(allocation)||allocation<1)throw new Error('Use a positive integer allocation from the recruitment roster.');
  if(items.length!==4)throw new Error('This counterbalancing scheme requires exactly four scenarios.');
  const cell=(allocation-1)%16, list=cell%4, layout=Math.floor(cell/4)%2?'mirrored':'standard';
  const probePattern=Math.floor(cell/8);
  return {allocation,cell:cell+1,list:list+1,layout,probe_pattern:probePattern+1,
    method:'Williams-4 x layout-2 x first-probe-pattern-2; roster-assigned',
    items:LATIN_SQUARE[list].map((index,position)=>({id:items[index].id,position:position+1,
      conditions:(index+probePattern)%2?['thick','thin']:['thin','thick']}))};
}
