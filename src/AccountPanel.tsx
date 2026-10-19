import React,{useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {cloud,googleSignIn,uploadDocument,listDocuments,downloadDocument,downloadBlob} from './cloud';
import type {Ledger} from './ledger';

export function AccountPanel({email,ledger,onSignOut,disabled=false}:{email:string|null;ledger:Ledger;onSignOut:()=>void;disabled?:boolean}){
 const [message,setMessage]=useState(''),[files,setFiles]=useState<{name:string}[]>([]),[working,setWorking]=useState(false);
 async function run(action:()=>Promise<void>){setWorking(true);setMessage('');try{await action();}catch(e){setMessage((e as Error).message);}finally{setWorking(false);}}
 function upload(){const input=document.createElement('input');input.type='file';input.accept='.pdf,.csv,.txt,.png,.jpg,.jpeg';input.onchange=()=>{const file=input.files?.[0];if(file)void run(async()=>{await uploadDocument(file);setFiles(await listDocuments());setMessage('File saved privately. This archives the original; use Import statement to add transactions.');});};input.click();}
 const button=(title:string,fn:()=>void)=> <Pressable accessibilityRole="button" disabled={disabled||working} style={[styles.button,(disabled||working)&&{opacity:.4}]} onPress={fn}><Text style={styles.link}>{title}</Text></Pressable>;
 return <View style={styles.card}>
  <Text style={styles.title}>{email?'Your account':'Keep your money story'}</Text>
  <Text style={styles.text}>{email||'Saved on this browser. Sign in to save online and open your records on another device.'}</Text>
  {!email&&<>{button('Continue with Google',()=>void run(googleSignIn))}<Text style={styles.small}>{cloud?'Google sign-in opens a separate cloud ledger. Your device records stay here. Export them before switching.':'Google sign-in awaits setup · see CLOUD-SETUP.md'}</Text></>}
  {button('Download my records (.json)',()=>downloadBlob(new Blob([JSON.stringify(ledger,null,2)],{type:'application/json'}),'paisavasool-records.json'))}
  {email&&<>{button('Save a statement or receipt',upload)}{button('Show my saved files',()=>void run(async()=>setFiles(await listDocuments())))}
   {files.map(f=><View key={f.name}>{button(f.name.split('--').slice(1).join('--')||f.name,()=>void run(async()=>downloadDocument(f.name)))}</View>)}
   {button('Sign out',onSignOut)}</>}
  {!!message&&<Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
  {!email&&<Text style={styles.small}>Device storage is not encrypted. Anyone using this browser profile can open it. Clearing site data removes it; keep a downloaded copy.</Text>}
 </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:'white',borderRadius:20,padding:20,marginBottom:24,borderWidth:1,borderColor:'#E1E7F0'},title:{fontSize:21,fontWeight:'700',color:'#142D4E',marginBottom:8},text:{fontSize:15,lineHeight:23,color:'#17263E',marginBottom:10},small:{fontSize:12,lineHeight:19,color:'#68768B'},button:{backgroundColor:'#EAF0FF',padding:14,borderRadius:12,marginVertical:5},link:{color:'#245BDD',fontWeight:'600',textAlign:'center'}});

