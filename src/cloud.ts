import {Platform} from 'react-native';
import {createClient} from '@supabase/supabase-js';
import type {Ledger} from './ledger';

const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloud=Platform.OS==='web'&&url&&key?createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}):null;
let owner:string|null=null;
let revision=0;
export function setCloudOwner(id:string|null){if(owner===id)return;owner=id;revision=0;}
export function cloudOwner(){return owner;}
export async function readCloudLedger():Promise<Ledger|null>{
 if(!cloud||!owner)throw Error('Sign in to access cloud records.');
 const {data,error}=await cloud.from('ledgers').select('data,revision').eq('user_id',owner).maybeSingle();
 if(error)throw error;
 revision=data?.revision||0;
 return data?.data||null;
}
export async function writeCloudLedger(data:Ledger){
 if(!cloud||!owner)throw Error('Sign in again before saving.');
 const {data:next,error}=await cloud.rpc('save_ledger',{ledger_data:data,expected_revision:revision});
 if(error)throw error;
 if(!next)throw Error('Another device changed your ledger. Download your current records, then reload before editing again.');
 revision=next;
}
export async function googleSignIn(){
 if(!cloud)throw Error('Google sign-in needs the Supabase configuration in CLOUD-SETUP.md.');
 const {error}=await cloud.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/'}});
 if(error)throw error;
}
export async function uploadDocument(file:File){
 if(!cloud||!owner)throw Error('Sign in to store documents online.');
 if(file.size>5_000_000)throw Error('Choose a file under 5 MB.');
 if(!/\.(pdf|csv|txt|png|jpe?g)$/i.test(file.name))throw Error('Choose a PDF, CSV, text, PNG or JPG file.');
 const path=owner+'/'+crypto.randomUUID()+'--'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
 const {error}=await cloud.storage.from('statements').upload(path,file,{upsert:false});
 if(error)throw error;
}
export async function listDocuments(){
 if(!cloud||!owner)return [];
 const {data,error}=await cloud.storage.from('statements').list(owner,{limit:1000,sortBy:{column:'created_at',order:'desc'}});
 if(error)throw error;
 return data||[];
}
export async function downloadDocument(name:string){
 if(!cloud||!owner)throw Error('Sign in again.');
 const {data,error}=await cloud.storage.from('statements').download(owner+'/'+name);
 if(error)throw error;
 downloadBlob(data,name.split('--').slice(1).join('--')||name);
}
export function downloadBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

