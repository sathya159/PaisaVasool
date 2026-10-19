export type Period='Week'|'Month'|'Quarter'|'Year';
const iso=(d:Date)=>d.toISOString().slice(0,10);
export function periodRange(anchor:string,period:Period){
 const d=new Date(anchor+'T12:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();
 if(period==='Week'){const start=new Date(d);start.setUTCDate(start.getUTCDate()-start.getUTCDay());const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return {from:iso(start),to:iso(end)};}
 const startMonth=period==='Year'?0:period==='Quarter'?Math.floor(m/3)*3:m;
 const length=period==='Year'?12:period==='Quarter'?3:1;
 return {from:iso(new Date(Date.UTC(y,startMonth,1,12))),to:iso(new Date(Date.UTC(y,startMonth+length,0,12)))};
}
export function shiftPeriod(anchor:string,period:Period,delta:number){
 const range=periodRange(anchor,period),d=new Date(range.from+'T12:00:00Z');
 if(period==='Week')d.setUTCDate(d.getUTCDate()+delta*7);
 else d.setUTCMonth(d.getUTCMonth()+delta*(period==='Year'?12:period==='Quarter'?3:1));
 return iso(d);
}
