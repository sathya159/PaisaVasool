import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';

const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function DateField({value,onChange}:{value:string;onChange:(date:string)=>void}){
 const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date(value+'T12:00:00'));
 const selected=new Date(value+'T12:00:00');
 const first=new Date(month.getFullYear(),month.getMonth(),1);
 const length=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((first.getDay()+length)/7)*7},(_,i)=>i-first.getDay()+1);
 function choose(date:Date){onChange(iso(date));setOpen(false);}
 return <View style={{marginBottom:15}}>
  <Text style={s.label}>Date</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Choose transaction date" accessibilityState={{expanded:open}} style={s.input} onPress={()=>{setMonth(selected);setOpen(!open);}}>
   <Text style={s.value}>{selected.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</Text><Text style={s.action}>Calendar ▦</Text>
  </Pressable>
  {open&&<View style={s.calendar}>
   <View style={s.heading}>
    <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={s.arrow} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Text style={s.action}>‹</Text></Pressable>
    <Text accessibilityRole="header" style={s.month}>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={s.arrow} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Text style={s.action}>›</Text></Pressable>
   </View>
   <View style={s.grid}>{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><Text key={day} style={s.weekday}>{day}</Text>)}</View>
   <View style={s.grid}>{cells.map((day,i)=>{
    if(day<1||day>length)return <View key={i} style={s.cell}/>;
    const date=new Date(month.getFullYear(),month.getMonth(),day),active=iso(date)===value;
    return <Pressable key={i} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} accessibilityState={{selected:active}} style={[s.cell,active&&s.selected]} onPress={()=>choose(date)}><Text style={[s.value,active&&{color:'white'}]}>{day}</Text></Pressable>;
   })}</View>
   <View style={s.heading}><Pressable accessibilityRole="button" style={s.arrow} onPress={()=>choose(new Date())}><Text style={s.action}>Today</Text></Pressable><Pressable accessibilityRole="button" style={s.arrow} onPress={()=>setOpen(false)}><Text style={s.action}>Cancel</Text></Pressable></View>
  </View>}
 </View>;
}
const s=StyleSheet.create({label:{fontSize:14,fontWeight:'600',color:'#17263E',marginBottom:8,marginTop:6},input:{backgroundColor:'white',borderWidth:1,borderColor:'#D8E0EC',borderRadius:12,padding:14,flexDirection:'row',justifyContent:'space-between',gap:10},value:{fontSize:16,color:'#17263E'},action:{fontSize:15,color:'#245BDD',fontWeight:'600'},calendar:{marginTop:8,padding:12,borderRadius:16,backgroundColor:'white',borderWidth:1,borderColor:'#D8E0EC'},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},month:{fontSize:16,fontWeight:'700',color:'#142D4E'},arrow:{padding:12,minHeight:44},grid:{flexDirection:'row',flexWrap:'wrap'},weekday:{width:'14.285714%',textAlign:'center',paddingVertical:10,fontSize:12,color:'#68768B'},cell:{width:'14.285714%',minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:10},selected:{backgroundColor:'#245BDD'}});

