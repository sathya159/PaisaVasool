import React,{useEffect,useState} from 'react';
import {Image,Modal,Pressable,Text,View} from 'react-native';
import {cloud} from './cloud';
export function ChatImage({path}:{path:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false),[open,setOpen]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;async function load(){try{const result=await cloud?.storage.from('community-images').createSignedUrl(path,3600);if(!active)return;if(result?.error||!result?.data?.signedUrl){setError(true);return;}setUrl(result.data.signedUrl);setError(false);}catch{if(active)setError(true);}}void load();const timer=setInterval(()=>void load(),45*60*1000);return ()=>{active=false;clearInterval(timer);};},[path,retry]);
 if(error)return <Pressable accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text style={{color:'#7054C7',padding:10}}>Picture unavailable · Retry</Text></Pressable>;
 if(!url)return <Text style={{padding:10,color:'#788395'}}>Loading picture…</Text>;
 return <><Pressable accessibilityRole="button" accessibilityLabel="Open shared picture" onPress={()=>setOpen(true)}><Image source={{uri:url}} accessibilityLabel="Shared community picture" resizeMode="contain" onError={()=>setError(true)} style={{width:210,height:180,borderRadius:10,backgroundColor:'#EAE6F0',marginVertical:6}}/></Pressable><Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={{flex:1,backgroundColor:'#141421F5',padding:20,paddingTop:55}}><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={{alignSelf:'flex-end',padding:14}}><Text style={{color:'white',fontSize:16}}>Close ×</Text></Pressable><Image source={{uri:url}} resizeMode="contain" style={{flex:1,width:'100%'}}/></View></Modal></>;
}

