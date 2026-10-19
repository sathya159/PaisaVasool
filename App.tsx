import React,{useEffect,useState} from 'react';
import {View,Text,ScrollView,Pressable,TextInput,StyleSheet,Modal,Platform,KeyboardAvoidingView,ActivityIndicator,Switch} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {loadLedger,saveLedger} from './src/storage';
import {emptyLedger,demoLedger,totals,active,uid,cents,review,suggest,linkTransfer,linkRefund,unlink,importRows,updateAccounts} from './src/ledger';
import type {Ledger,Transaction,Currency,Kind} from './src/ledger';
import {parseCSV,inferMapping,csvTransactions} from './src/csv';
import type {Mapping} from './src/csv';
import {learnedProposal,reasonOnlyProposal,acceptProposals,applyKnownHistory} from './src/assistant';
import type {Proposal} from './src/assistant';
import {assistantStatus,classifyOnPhone,extractOnPhone} from './src/ondevice';
import {cloud,setCloudOwner} from './src/cloud';
import {AccountPanel} from './src/AccountPanel';
import {AccountDrawer} from './src/AccountDrawer';
import {Community} from './src/Community';
import {moneyOwed,trackSplit,linkRepayment} from './src/receivables';
import {activityTitle} from './src/presentation';
import {StatementImport} from './src/StatementImport';
import {Dashboard} from './src/Dashboard';
import {DateField} from './src/DateField';
import {offlineProposal} from './src/offline-assistant';
import {hostedAiConfigured,hostedAiStatus,classifyHosted} from './src/hosted-ai';

const navy='#142D4E',blue='#245BDD',ink='#17263E',muted='#68768B';
const money=(n:number,c:Currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(n/100);
const today=()=>new Date().toLocaleDateString('en-CA');
const label=(s:string)=>s==='unreviewed'?'Needs context':s==='familyfund'?'Family fund':s.charAt(0).toUpperCase()+s.slice(1);
function Button({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&{opacity:.45}]}><Text style={[s.buttonText,secondary&&{color:blue}]}>{title}</Text></Pressable>;
}
function Field({title,value,onChange,placeholder='',multiline=false}:{title:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean}){
  return <View style={{marginBottom:15}}><Text style={s.label}>{title}</Text><TextInput accessibilityLabel={title} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#8290A0" multiline={multiline} style={[s.input,multiline&&{minHeight:75}]} autoCapitalize="sentences"/></View>;
}
function Chips({values,value,onChange}:{values:{id:string;name:string}[];value:string;onChange:(v:string)=>void}){
  return <View style={s.chips}>{values.map(v=><Pressable accessibilityRole="button" accessibilityState={{selected:v.id===value}} key={v.id} onPress={()=>onChange(v.id)} style={[s.chip,v.id===value&&s.chipSelected]}><Text style={[s.chipText,v.id===value&&{color:'white'}]}>{v.name}</Text></Pressable>)}</View>;
}
export default function App(){
 const [identity,setIdentity]=useState<{id:string;email:string}|null>(null),[authReady,setAuthReady]=useState(!cloud),[authError,setAuthError]=useState('');
 useEffect(()=>{
  if(!cloud)return;
  const {data:{subscription}}=cloud.auth.onAuthStateChange((_event,session)=>{
   setCloudOwner(session?.user.id||null);
   setIdentity(session?{id:session.user.id,email:session.user.email||'Google account'}:null);setAuthReady(true);
  });
  cloud.auth.getSession().then(({error})=>{if(error){setAuthError(error.message);setAuthReady(true);}}).catch(e=>{setAuthError(e.message);setAuthReady(true);});
  return ()=>subscription.unsubscribe();
 },[]);
 async function signOut(){const result=await cloud?.auth.signOut();if(result?.error)setAuthError(result.error.message);}
 if(!authReady)return <View style={{padding:40}}><ActivityIndicator/><Text>Opening your account…</Text></View>;
 if(authError)return <View style={{padding:40}}><Text>{authError}</Text><Button title="Try again" onPress={()=>Platform.OS==='web'&&window.location.reload()}/></View>;
 return <LedgerApp key={identity?.id||'device'} email={identity?.email||null} onSignOut={()=>void signOut()}/>;
}
function LedgerApp({email,onSignOut}:{email:string|null;onSignOut:()=>void}){
 const [ledger,setLedger]=useState<Ledger>(emptyLedger()),[ready,setReady]=useState(false),[fatal,setFatal]=useState(''),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState('Overview'),[currency,setCurrency]=useState<Currency>('USD'),[notice,setNotice]=useState('');
 const [region,setRegion]=useState('all'),[accountFilter,setAccountFilter]=useState('');
 const [from,setFrom]=useState(()=>today().slice(0,7)+'-01'),[to,setTo]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth()+1,0).toLocaleDateString('en-CA'));
 const [sheet,setSheet]=useState<'edit'|'import'|'match'|'reset'|'assistant'|null>(null),[selected,setSelected]=useState<Transaction|null>(null);
 const [form,setForm]=useState({accountId:'',date:today(),amount:'',direction:'out',kind:'expense' as Kind,person:'Me',category:'',reason:''});
 const [editCategory,setEditCategory]=useState(false);
 const [showFilters,setShowFilters]=useState(false),[showDetails,setShowDetails]=useState(false),[changePerson,setChangePerson]=useState(false),[personOverride,setPersonOverride]=useState(false);
 const [chooseAccount,setChooseAccount]=useState(false);
 const [manualImport,setManualImport]=useState(false);
 const [drawer,setDrawer]=useState(false);
 const [splitAmount,setSplitAmount]=useState(''),[splitPerson,setSplitPerson]=useState('');
 const [reviewPeople,setReviewPeople]=useState<Record<string,string>>({}),[peopleOpen,setPeopleOpen]=useState<Record<string,boolean>>({});
 const [matchType,setMatchType]=useState<'transfer'|'refund'|'loan'|'split'>('transfer');
 const [importAccount,setImportAccount]=useState(''),[rows,setRows]=useState<string[][]>([]),[hash,setHash]=useState(''),[filename,setFilename]=useState(''),[mapping,setMapping]=useState<Mapping>(inferMapping([]));
 const [preview,setPreview]=useState<Transaction[]>([]),[error,setError]=useState('');
 const [aiInfo,setAiInfo]=useState({ready:false,message:'Checking on-device assistant…',engine:'Saved history'});
 const categoryInfo=aiInfo.ready?aiInfo:hostedAiConfigured?hostedAiStatus():aiInfo;
 async function categorizeReason(t:Transaction,answer:string){
  try{if(aiInfo.ready)return await classifyOnPhone(ledger,t,answer);if(hostedAiConfigured)return await classifyHosted(ledger,t,answer);}catch{setNotice('AI is temporarily unavailable. Using confirmed history where possible; other entries stay in Review.');return offlineProposal(ledger,t,answer);}
  return offlineProposal(ledger,t,answer);
 }
 const [answers,setAnswers]=useState<Record<string,string>>({}),[proposals,setProposals]=useState<Record<string,Proposal>>({}),[workingId,setWorkingId]=useState('');
 const [readProgress,setReadProgress]=useState(''),[extractionWarnings,setExtractionWarnings]=useState<string[]>([]);
 useEffect(()=>{assistantStatus().then(setAiInfo).catch(e=>setAiInfo({ready:false,engine:'Unavailable',message:e.message}));},[]);
 useEffect(()=>{loadLedger().then(x=>{setLedger(updateAccounts(x));setReady(true);}).catch(e=>setFatal(e.message));},[]);
 async function commit(next:Ledger,message:string,keepOpen=false){
   if(busy)return;
   setBusy(true);setError('');
   try{await saveLedger(next);setLedger(next);setNotice(message);if(!keepOpen)setSheet(null);return true;}
   catch(e){setError((e as Error).message);setNotice('Could not save. Your previous ledger is unchanged.');return false;}
   finally{setBusy(false);}
 }
 function openEdit(t?:Transaction){
   if(!t&&!ledger.accounts.length){setNotice('Add an account or import a statement to get started.');setDrawer(true);return;}
   setSelected(t||null);setSplitAmount(t?.splitOwed?String(t.splitOwed/100):'');setSplitPerson(t?.splitFrom||'');setError('');setEditCategory(false);setShowDetails(!t);setChangePerson(false);setPersonOverride(false);setChooseAccount(false);
   setForm(t?{accountId:t.accountId,date:t.date,amount:(Math.abs(t.amount)/100).toFixed(2),direction:t.amount<0?'out':'in',kind:t.kind==='unreviewed'?(t.amount<0?'expense':'income'):t.kind,person:t.person||'Me',category:t.category,reason:t.reason||t.description}:{accountId:ledger.accounts[0]?.id||'',date:today(),amount:'',direction:'out',kind:'expense',person:'Me',category:'',reason:''});
   setSheet('edit');
 }
 function attempt(fn:()=>void){try{setError('');fn();}catch(e){setError((e as Error).message);}}
 async function saveReview(reviewLater=false){
   setWorkingId(selected?.id||'new');
   try { setError('');
     const account=ledger.accounts.find(a=>a.id===form.accountId);if(!account)throw Error('Add or choose an account first.');
     const amount=cents(form.amount);if(amount<=0)throw new Error('Enter a positive amount and choose Spent or Received.');
     const description=form.reason.trim();if(!description)throw Error('Describe what you spent or received and what it was for.');
     const tx:Transaction={...selected,id:selected?.id||uid(),accountId:account.id,currency:account.currency,date:form.date,description:selected?.sourceId?selected.description:description,amount:amount*(form.direction==='out'?-1:1),kind:reviewLater?'unreviewed':form.kind,person:form.person,category:form.category,reason:description};
     if(!editCategory&&['expense','income','investment','loan'].includes(tx.kind)){
       const p=await categorizeReason(tx,form.reason);
       if(p&&tx.amount>0&&p.match&&p.match!=='none'){
        const incoming={...tx,kind:'unreviewed' as Kind,reason:form.reason,merchant:p.merchant,category:p.category};
        if(await commit(review(ledger,incoming),'Incoming payment saved. Confirm what it returns before totals change.',true)){setSelected(incoming);setMatchType(p.match);setSheet('match');}return;
       }
       if(p?.basis==='offline-review'){await commit(review(ledger,{...tx,kind:'unreviewed',category:'',reason:form.reason}),'Saved for Review. AI is temporarily unavailable; your description is kept.');return;}
       if(!p||p.question||p.kind==='unreviewed')throw Error(p?.question||'Tell me what the payment covered.');
       Object.assign(tx,{person:personOverride?form.person:p.person,category:p.category,reason:p.reason,kind:p.kind,merchant:p.merchant});
     }
     await commit(review(ledger,tx),reviewLater?'Saved for matching. Open this payment in Activity and choose what it repays.':'Saved as '+tx.person+' → '+tx.category+'. You can change it in Activity.');
   }catch(e){setError((e as Error).message);}finally{setWorkingId('');}
 }
 async function chooseFile(){
   setError('');setPreview([]);
   try{
     const result=await DocumentPicker.getDocumentAsync({type:['text/csv','text/comma-separated-values','application/csv','public.comma-separated-values-text'],copyToCacheDirectory:true});
     if(result.canceled)return;
     const asset=result.assets[0];
     if((asset.size||0)>5_000_000)throw new Error('Please split files larger than 5 MB.');
     let text:string;
     if(Platform.OS==='web')text=await (await fetch(asset.uri)).text();
     else {const file=new File(asset.uri);try{text=await file.text();}finally{file.delete();}}
     if(text.length>5_000_000)throw new Error('Please split files larger than 5 MB.');
     const parsed=parseCSV(text);setRows(parsed);setMapping(inferMapping(parsed[0]));setFilename(asset.name);
     setHash(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text));
   }catch(e){setError((e as Error).message);}
 }

 function openAssistant(){
  setError('');setAnswers({});setProposals({});setReviewPeople({});setPeopleOpen({});setSheet('assistant');
 }
 async function suggestContext(t:Transaction){
  setWorkingId(t.id);setError('');
  try {
   const answer=answers[t.id]||'';
   const proposed=answer.trim()
    ? await categorizeReason(t,answer)
    : learnedProposal(ledger,t);
   if(!proposed)throw Error('Tell me what this payment was for.');
   if(t.amount>0&&proposed.match&&proposed.match!=='none'){
    const incoming={...t,reason:answer,merchant:proposed.merchant,category:proposed.category};
    if(await commit(review(ledger,incoming),'Confirm what this payment returns.',true)){setSelected(incoming);setMatchType(proposed.match);setSheet('match');}return;
   }
   if(proposed.basis==='offline-review'){await commit({...ledger,transactions:ledger.transactions.map(row=>row.id===t.id?{...row,reason:answer}:row)},'Description saved. Retry categorization when AI is available.',true);setProposals(current=>({...current,[t.id]:proposed}));return;}
   if(proposed.question||proposed.kind==='unreviewed'){setProposals(current=>({...current,[t.id]:proposed}));return;}
   if(reviewPeople[t.id])proposed.person=reviewPeople[t.id];
   await commit(acceptProposals(ledger,[proposed]),'Saved as '+proposed.person+' → '+proposed.category+'. Change it anytime in Activity.',true);
  } catch(e){setError((e as Error).message);}
  finally{setWorkingId('');}
 }
 async function readStatement(){
  if(!aiInfo.ready){setError(aiInfo.message);return;}
  setError('');setReadProgress('Choose a statement…');setExtractionWarnings([]);setPreview([]);
  let uri='';
  try{
   const result=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/*','text/plain','text/csv'],copyToCacheDirectory:true});
   if(result.canceled)return;
   const asset=result.assets[0];uri=asset.uri;
   if((asset.size||0)>5_000_000)throw Error('Please split statements larger than 5 MB.');
   const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,await new File(uri).base64());
   const resultRows=await extractOnPhone(uri,ledger.accounts.find(a=>a.id===importAccount)!,digest,setReadProgress);
   importRows(ledger,resultRows.rows,from,to);
   setRows([]);setFilename(asset.name);setPreview(resultRows.rows);setExtractionWarnings(resultRows.warnings);
  }catch(e){setError((e as Error).message);}
  finally{if(uri){try{new File(uri).delete();}catch{}}setReadProgress('');}
 }
 function confirmImport(){
  attempt(()=>{
   const imported=importRows(ledger,preview,from,to);
   const remembered=applyKnownHistory(imported.state);
   void commit(remembered.state,imported.added+' added; '+remembered.count+' categorized from your history; '+imported.skipped+' repeats skipped; '+imported.possible+' possible duplicates; '+imported.outside+' outside date range.');
  });
 }

 const total=totals(ledger,currency,from,to);
 const regionChoices=[{id:'all',name:'USA + India'},{id:'USD',name:'USA'},{id:'INR',name:'India'}];
 const inRegion=(t:{currency:Currency})=>region==='all'||t.currency===region;
 const inbox=ledger.transactions.filter(t=>!t.ignored&&(t.kind==='unreviewed'||t.duplicateOf));
 const filtered=ledger.transactions.filter(t=>!t.ignored&&inRegion(t)&&(!accountFilter||t.accountId===accountFilter)&&t.date>=from&&t.date<=to).sort((a,b)=>b.date.localeCompare(a.date));
 const categoryTotals:Record<string,number>={};
 ledger.transactions.filter(t=>active(t)&&t.currency===currency&&t.date>=from&&t.date<=to&&(t.kind==='expense'||t.kind==='refund')).forEach(t=>{const cat=t.refundOf?ledger.transactions.find(o=>o.id===t.refundOf)?.category||t.category:t.category;categoryTotals[cat]=(categoryTotals[cat]||0)-t.amount;});
 const isLinked=!!selected&&(!!selected.transferId||!!selected.refundOf||!!selected.loanOf||ledger.transactions.some(t=>t.refundOf===selected.id||t.loanOf===selected.id));

 const owed=moneyOwed(ledger,currency);
 const matches=selected?ledger.transactions.filter(t=>t.id!==selected.id&&active(t)&&!t.transferId&&!t.refundOf&&!t.loanOf&&(matchType==='loan'?t.kind==='loan'&&t.currency===selected.currency&&t.date<=selected.date:matchType==='split'?t.kind==='expense'&&t.currency===selected.currency&&t.date<=selected.date:matchType==='refund'?t.kind==='expense'&&t.amount<0&&t.currency===selected.currency&&t.date<=selected.date:t.accountId!==selected.accountId&&t.amount*selected.amount<0&&(t.currency!==selected.currency||t.amount===-selected.amount))):[];
 const update=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
 function row(t:Transaction){
   return <Pressable accessibilityRole="button" accessibilityLabel={activityTitle(t)+' '+money(t.amount,t.currency)} key={t.id} onPress={()=>openEdit(t)} style={s.txRow}>
    <View style={[s.avatar,{backgroundColor:t.kind==='transfer'?'#EAF0F7':t.amount>0?'#E4F4EF':'#F0EDFF'}]}><Text style={{color:navy,fontSize:19}}>{t.kind==='transfer'?'⇄':t.kind==='refund'?'↩':t.amount>0?'+':'−'}</Text></View>
    <View style={{flex:1}}><Text style={s.txTitle}>{activityTitle(t)}</Text><Text style={s.meta}>{t.date}{t.duplicateOf?' · Possible duplicate':''}</Text></View>
    <Text style={[s.amount,t.amount>0&&{color:'#147961'}]}>{money(t.amount,t.currency)}</Text>
   </Pressable>;
 }
 if(fatal)return <SafeAreaProvider><SafeAreaView style={s.root}><View style={s.content}><Text style={s.title}>Storage unavailable</Text><Text style={s.body}>{fatal}</Text><Text style={s.body}>{Platform.OS==='web'?'Your saved records have not been replaced. Check your connection and cloud setup, then retry.':'Use the native development build described in the project README.'}</Text>{Platform.OS==='web'&&<><Button title="Try loading again" onPress={()=>window.location.reload()}/>{email&&<Button secondary title="Sign out" onPress={onSignOut}/>}</>}</View></SafeAreaView></SafeAreaProvider>;
 if(!ready)return <SafeAreaProvider><SafeAreaView style={s.root}><ActivityIndicator accessibilityLabel="Loading ledger" style={{marginTop:80}}/></SafeAreaView></SafeAreaProvider>;
 return <SafeAreaProvider><SafeAreaView style={s.root}><StatusBar style="dark"/>
  <View style={s.shell}>
   <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Open accounts and settings" onPress={()=>setDrawer(true)} style={{padding:8,marginLeft:-8}}><Text style={{fontSize:25,color:navy}}>☰</Text></Pressable><View style={{flex:1,marginLeft:8}}><Text style={[s.wordmark,{fontSize:25}]}>paisavasool<Text style={{color:blue}}>·</Text></Text><Text style={s.meta}>Your money, with context</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add transaction" onPress={()=>openEdit()} style={s.add}><Text style={{color:'white',fontSize:28}}>+</Text></Pressable></View>
   {Platform.OS==='web'&&<Pressable accessibilityRole="button" onPress={()=>setDrawer(true)}><Text style={s.previewBanner}>{email?'Cloud account · '+email:'Saved on this browser · sign in for cloud saving'}</Text></Pressable>}
   {ledger.demo&&<Text style={s.previewBanner}>Sample ledger · clear in Accounts before adding real data</Text>}
   {!!notice&&<Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={()=>setNotice('')}><Text style={s.notice}>{notice} ×</Text></Pressable>}
   <ScrollView testID="main-scroll" contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" >
    {tab==='Overview'&&<Dashboard onActivity={()=>setTab('Activity')} ledger={ledger} onOpen={openEdit} onReview={openAssistant}/>}
    {tab==='Review'&&<><Text style={s.eyebrow}>JUST TELL THE STORY</Text><Text style={s.title}>What was it for?</Text><Text style={s.body}>Most spending is for you. Describe the purchase; mention someone else only when it was for them.</Text><Button title="Describe my expenses" onPress={openAssistant}/>{inbox.map(row)}{!inbox.length&&<View style={s.empty}><Text style={s.sectionTitle}>All caught up.</Text><Text style={s.body}>New imports and possible duplicates will appear here.</Text></View>}</>}
    {tab==='Activity'&&<><Text style={s.eyebrow}>YOUR LEDGER</Text><Text style={s.title}>The whole story.</Text><Text style={s.meta}>Categories are suggested automatically. Tap a transaction to correct one.</Text><Text style={s.body}>{from} through {to}</Text><Chips values={regionChoices} value={region} onChange={v=>{setRegion(v);setAccountFilter('');}}/>{!!accountFilter&&<Pressable accessibilityRole="button" onPress={()=>setAccountFilter('')}><Text style={s.meta}>{ledger.accounts.find(a=>a.id===accountFilter)?.name} · Clear account filter ×</Text></Pressable>}<Button secondary title={showFilters?'Hide dates':'Change dates'} onPress={()=>setShowFilters(!showFilters)}/>{showFilters&&<><DateField value={from} onChange={setFrom}/><DateField value={to} onChange={setTo}/></>} {filtered.map(row)}{!filtered.length&&<Text style={s.body}>No transactions in this period.</Text>}</>}
    {tab==='Community'&&<Community email={email}/> }
    <Text style={s.footer}>Private by design. Clear by purpose.</Text>
   </ScrollView>
   <View style={s.nav}>{[{id:'Overview',icon:'◫'},{id:'Review',icon:'✓'},{id:'Activity',icon:'≡'},{id:'Community',icon:'♧'}].map(item=><Pressable key={item.id} accessibilityRole="tab" accessibilityState={{selected:tab===item.id}} onPress={()=>setTab(item.id)} style={s.navItem}><Text style={[s.navIcon,tab===item.id&&{color:blue}]}>{item.icon}</Text><Text style={[s.navLabel,tab===item.id&&{color:blue,fontWeight:'700'}]}>{item.id}{item.id==='Review'&&inbox.length?' '+inbox.length:''}</Text></Pressable>)}</View>
  </View>
  <AccountDrawer visible={drawer} onClose={()=>setDrawer(false)} ledger={ledger} email={email} onSignOut={onSignOut} busy={busy} onSave={async next=>!!(await commit(next,'Account added.'))} onImport={()=>{setDrawer(false);setSheet('import');setManualImport(false);setError('');setRows([]);setPreview([]);setImportAccount(ledger.accounts[0]?.id||'');}} onReset={()=>{setDrawer(false);setSheet('reset');setError('');}} onActivity={account=>{setDrawer(false);setRegion(account.currency);setAccountFilter(account.id);setTab('Activity');}}/>
  <Modal visible={!!sheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>!busy&&!workingId&&!readProgress&&setSheet(null)}>
   <SafeAreaView style={s.root}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={[s.shell,{flex:1}]}>
    <View style={s.modalHeader}><Text style={s.sectionTitle}>{sheet==='assistant'?'A little context':sheet==='import'?'Import statement':sheet==='match'?(matchType==='transfer'?'Match transfer':matchType==='loan'?'Match loan repayment':matchType==='split'?'Match shared expense':'Match refund'):sheet==='reset'?'Clear ledger':selected?'Transaction context':'Add transaction'}</Text><Button secondary title="Close" disabled={busy||!!workingId||!!readProgress} onPress={()=>setSheet(null)}/></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
     {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}

     {sheet==='assistant'&&<>
      <Text style={s.body}>Describe what you bought and why. The category is chosen for you, and your saved reasons help next time.</Text>
      <Text style={s.meta}>{categoryInfo.message}</Text>
      {(()=>{
       const pending=ledger.transactions.filter(t=>active(t)&&t.kind==='unreviewed');
       const remembered=pending.map(t=>learnedProposal(ledger,t)).filter((p):p is Proposal=>!!p);
       return <>{remembered.length>0&&<View style={s.explainer}><Text style={s.cardTitle}>{remembered.length} familiar transactions</Text>{remembered.map(p=><Text key={p.id} style={s.body}>{ledger.transactions.find(t=>t.id===p.id)?.description} → {p.person} · {p.category}</Text>)}<Button title="Confirm familiar categories together" disabled={busy||!!workingId} onPress={()=>attempt(()=>void commit(acceptProposals(ledger,remembered),'Confirmed using your history.',true))}/></View>}
       <Text style={[s.meta,{marginVertical:12}]}>{pending.length} left to review · one expense at a time</Text>
       {pending.filter(t=>!remembered.some(p=>p.id===t.id)).slice(0,1).map(t=>{
        const p=proposals[t.id];
        return <View key={t.id} style={s.accountCard}>
         <Text style={s.cardTitle}>{t.description}</Text><Text style={s.meta}>{t.date} · {ledger.accounts.find(a=>a.id===t.accountId)?.name} · {money(t.amount,t.currency)}</Text>
         <View style={s.between}><Text style={s.label}>For: {(reviewPeople[t.id]||'Me')==='Me'?'Myself':reviewPeople[t.id]}</Text><Pressable accessibilityRole="button" onPress={()=>setPeopleOpen(v=>({...v,[t.id]:!v[t.id]}))}><Text style={{color:blue,padding:8}}>Change</Text></Pressable></View>
         {peopleOpen[t.id]&&<Field title="Person (optional)" value={reviewPeople[t.id]||'Me'} onChange={v=>setReviewPeople(p=>({...p,[t.id]:v}))} placeholder="Myself, Dad, Brother, or a name"/>}
         <Field title="Describe this transaction" value={answers[t.id]||''} onChange={v=>{setAnswers(a=>({...a,[t.id]:v}));setProposals(current=>{const next={...current};delete next[t.id];return next;});}} placeholder="e.g. Bought vegetables and milk at Costco for my weekly meals" multiline/>
         <Text style={s.meta}>For someone else? Mention them in your description, or use Change.</Text>
         {!!p?.question&&<Text style={s.error}>{p.question}</Text>}
         <Button secondary title={workingId===t.id?'Categorizing…':'Save from my reason'} disabled={!!workingId||busy} onPress={()=>void suggestContext(t)}/>

         <Button secondary title="Edit details / match transfer or refund" disabled={!!workingId||busy} onPress={()=>openEdit(t)}/>
        </View>;
       })}
       {!pending.length&&<Text style={s.sectionTitle}>All ordinary transactions are reviewed.</Text>}
       {inbox.some(t=>t.duplicateOf)&&<Text style={s.body}>Possible duplicates still need confirmation in the Review tab.</Text>}
       </>;
      })()}
     </>}

     {sheet==='reset'&&<><Text style={s.body}>This permanently clears transactions and learned categories {email?'in your cloud account':'on this device'}. Saved statement files are not deleted. Download your records first; there is no undo.</Text><Button title="Clear all transactions" disabled={busy} onPress={()=>void commit(emptyLedger(),'Ledger cleared.')}/></>}
     {sheet==='edit'&&<>
      {selected?.duplicateOf&&<View style={s.explainer}><Text style={s.cardTitle}>Possible duplicate</Text><Text style={s.body}>Same account, date, description, and amount as another entry. This entry is excluded until you decide.</Text><Button title="Keep as a separate transaction" disabled={busy} onPress={()=>void commit({...ledger,transactions:ledger.transactions.map(t=>t.id===selected.id?{...t,duplicateOf:undefined}:t)},'Kept separately; ready for review.')}/><Button secondary title="Confirm duplicate · exclude" disabled={busy} onPress={()=>void commit({...ledger,transactions:ledger.transactions.map(t=>t.id===selected.id?{...t,ignored:true,duplicateOf:undefined}:t)},'Duplicate excluded; source record retained.')}/></View>}
      {!selected?.duplicateOf&&<>
      {selected&&<><Text style={s.cardTitle}>{selected.description} · {money(selected.amount,selected.currency)}</Text><Text style={s.meta}>{selected.date} · {ledger.accounts.find(a=>a.id===selected.accountId)?.name}</Text>{!!selected.reason&&<Text style={s.body}>{selected.reason}</Text>}<Button secondary title={showDetails?'Hide transaction details':'Edit transaction details'} onPress={()=>setShowDetails(!showDetails)}/></>}
      {showDetails&&<><Text style={s.label}>Account</Text><Pressable accessibilityRole="button" disabled={!!selected} onPress={()=>setChooseAccount(!chooseAccount)}><Text style={[s.body,{color:blue}]}>{ledger.accounts.find(a=>a.id===form.accountId)?.name}{!selected?' · Change account':''}</Text></Pressable>{chooseAccount&&<Chips values={ledger.accounts.map(a=>({id:a.id,name:a.name}))} value={form.accountId} onChange={v=>{update('accountId',v);setChooseAccount(false);}}/>}
      {!!selected&&<Text style={s.meta}>Imported account is fixed to preserve source identity.</Text>}
      <DateField value={form.date} onChange={v=>update('date',v)}/>
      <Field title={'Amount · '+ledger.accounts.find(a=>a.id===form.accountId)?.currency} value={form.amount} onChange={v=>update('amount',v)} placeholder={ledger.accounts.find(a=>a.id===form.accountId)?.currency==='INR'?'15000.00':'125.00'}/>
      <Chips values={[{id:'out',name:'Spent'},{id:'in',name:'Received'}]} value={form.direction} onChange={v=>update('direction',v)}/>
      </>}
      {!isLinked&&<>
       <View style={s.between}><Text style={s.label}>For: {form.person==='Me'?'Myself':form.person}</Text><Pressable accessibilityRole="button" onPress={()=>setChangePerson(!changePerson)}><Text style={{color:blue,padding:8}}>Change</Text></Pressable></View>
       {changePerson&&<Field title="Person (optional)" value={form.person} onChange={v=>{update('person',v);setPersonOverride(true);}} placeholder="Myself, Dad, Brother, or a name"/>}
       <Field title="Describe this transaction" value={form.reason} onChange={v=>update('reason',v)} placeholder="e.g. Bought vegetables and milk at Costco for my weekly meals" multiline/>
       <Text style={s.meta}>One description is enough: what it was for, and optionally where. We’ll choose the category. Mention someone else only if it was for them.</Text>
       {hostedAiConfigured&&!aiInfo.ready&&<Text style={s.meta}>Groq AI processes your description and relevant category history when you save.</Text>}
       {editCategory?<><Text style={s.label}>Track as</Text><Chips values={[{id:'expense',name:'Expense'},{id:'income',name:'Income'},{id:'investment',name:'Investment'},{id:'loan',name:'Loan lent'},{id:'unreviewed',name:'Review later'}]} value={form.kind} onChange={v=>update('kind',v)}/><Field title="Category correction" value={form.category} onChange={v=>update('category',v)} placeholder="Your preferred category"/></>:<Text style={s.meta}>Category and payment type are chosen automatically.</Text>}
       {form.direction==='in'&&<Button secondary title="Save incoming payment to match later" disabled={busy||!!workingId} onPress={()=>void saveReview(true)}/>}
       <Button title={busy||workingId?'Saving…':'Save from my reason'} onPress={()=>void saveReview()} disabled={busy||!!workingId}/>
       <Pressable accessibilityRole="button" onPress={()=>setEditCategory(!editCategory)}><Text style={[s.meta,{color:blue,textAlign:'center',padding:10}]}>{editCategory?'Choose automatically instead':'Adjust category (optional)'}</Text></Pressable>
       {selected&&<><Text style={[s.sectionTitle,{marginTop:25}]}>Money moved or came back?</Text><Text style={s.body}>These actions use the saved transaction. Save any edits first.</Text><Button secondary title="Match an account transfer" onPress={()=>{setMatchType('transfer');setSheet('match');setError('');}}/>{selected.amount>0&&<><Button secondary title="Match a loan repayment" onPress={()=>{setMatchType('loan');setSheet('match');setError('');}}/><Button secondary title="Match a shared-expense repayment" onPress={()=>{setMatchType('split');setSheet('match');setError('');}}/></>}{selected.amount>0&&<Button secondary title="Match a refund" onPress={()=>{setMatchType('refund');setSheet('match');setError('');}}/>}</>}
      </>}
      {selected?.kind==='expense'&&<View style={s.explainer}><Text style={s.cardTitle}>Shared this expense?</Text><Field title="Who owes you?" value={splitPerson} onChange={setSplitPerson} placeholder="e.g. Sunandhan"/><Field title="Total share owed to you" value={splitAmount} onChange={setSplitAmount} placeholder="e.g. 25.00"/><Button secondary title="Save shared amount" disabled={busy} onPress={()=>attempt(()=>void commit(trackSplit(ledger,selected.id,cents(splitAmount||'0'),splitPerson),'Shared expense added to Money owed to you.'))}/></View>}
      {isLinked&&<View style={s.explainer}><Text style={s.cardTitle}>{selected?.transferId?'Matched account transfer':'Linked repayment or refund'}</Text><Text style={s.body}>Unlink before editing. This returns related entries to review.</Text><Button secondary title="Unlink and review again" disabled={busy} onPress={()=>void commit(unlink(ledger,selected!.id),'Unlinked. Related entries need review.')}/></View>}
      </>}
     </>}
     {sheet==='match'&&selected&&<><Text style={s.cardTitle}>{selected.description} · {money(selected.amount,selected.currency)}</Text><Text style={s.body}>{matchType==='transfer'?'Choose the other side of this transfer. Cross-currency amounts must be the actual amounts sent and received. Log fees separately.':matchType==='loan'?'Choose the loan this payment repays. Partial repayments are supported.':matchType==='split'?'Choose the shared expense this payment reimburses.': 'Choose the original expense. Partial refunds are supported; total refunds cannot exceed the purchase.'}</Text>{matches.map(t=><View key={t.id} style={s.accountCard}><Text style={s.cardTitle}>{t.description}</Text><Text style={s.body}>{t.date} · {ledger.accounts.find(a=>a.id===t.accountId)?.name} · {money(t.amount,t.currency)}</Text><Button title="Confirm match" disabled={busy} onPress={()=>attempt(()=>void commit(matchType==='transfer'?linkTransfer(ledger,selected.id,t.id):matchType==='loan'||matchType==='split'?linkRepayment(ledger,selected.id,t.id,matchType):linkRefund(ledger,selected.id,t.id),'Matched. Totals updated.'))}/></View>)}{!matches.length&&<Text style={s.body}>No eligible matches yet. Import or manually add the other transaction using “Review later,” then return here.</Text>}</>}
     {sheet==='import'&&!manualImport&&<StatementImport accounts={ledger.accounts} from={from} to={to} onManual={()=>setManualImport(true)} onConfirm={async(rows,start,end,accounts)=>{const imported=importRows({...ledger,accounts},rows,start,end);if(!await commit(applyKnownHistory(imported.state).state,imported.added+' transactions imported; '+imported.skipped+' repeats skipped; '+imported.possible+' possible duplicates need review.'))throw Error('Could not save. Please retry.');}}/>}
     {sheet==='import'&&manualImport&&<><Button secondary title="Back to AI PDF / CSV import" onPress={()=>setManualImport(false)}/>
      <Text style={s.body}>On iPhone, let Apple AI read a PDF, statement image, or CSV. Check the extracted entries once, then answer only the missing context. CSV import is also available in this browser preview.</Text>
      <Text style={s.label}>Import into</Text><Chips values={ledger.accounts.filter(a=>a.type!=='fund').map(a=>({id:a.id,name:a.name}))} value={importAccount} onChange={v=>{setImportAccount(v);setPreview([]);}}/>
      <View style={s.period}><View style={{flex:1}}><Field title="From (YYYY-MM-DD)" value={from} onChange={v=>{setFrom(v);setPreview([]);}}/></View><View style={{flex:1}}><Field title="Through (YYYY-MM-DD)" value={to} onChange={v=>{setTo(v);setPreview([]);}}/></View></View>
      <Button title={readProgress||'Read statement on my iPhone'} disabled={!!readProgress||busy} onPress={()=>void readStatement()}/>
      {!aiInfo.ready&&<Text style={s.meta}>{aiInfo.message}</Text>}
      <Button secondary disabled={!!readProgress||busy} title={filename?'Choose another CSV':'Choose CSV file'} onPress={()=>void chooseFile()}/>
      {!!rows.length&&<>
       <Text style={s.cardTitle}>{filename} · {rows.length-1} rows</Text>
       {(['date','description','amount','debit','credit','reference'] as const).map(key=><View key={key}><Text style={s.label}>{label(key)} column</Text><Chips values={[{id:'-1',name:'None'},...rows[0].map((h,i)=>({id:String(i),name:h}))]} value={String(mapping[key])} onChange={v=>{setMapping(m=>({...m,[key]:Number(v)}));setPreview([]);}}/></View>)}
       <Text style={s.meta}>Use either Amount, or set Amount to None and map Debit/Credit.</Text>
       <Text style={s.label}>Date format</Text><Chips values={[{id:'ISO',name:'YYYY-MM-DD'},{id:'MDY',name:'MM/DD/YYYY'},{id:'DMY',name:'DD/MM/YYYY'}]} value={mapping.format} onChange={v=>{setMapping(m=>({...m,format:v as Mapping['format']}));setPreview([]);}}/>
       <Text style={s.label}>For a signed Amount column</Text><Chips values={[{id:'in',name:'Positive = money in'},{id:'out',name:'Positive = money out'}]} value={mapping.outPositive?'out':'in'} onChange={v=>{setMapping(m=>({...m,outPositive:v==='out'}));setPreview([]);}}/>
       <Button title="Preview transactions" onPress={()=>attempt(()=>{const parsed=csvTransactions(rows,mapping,ledger.accounts.find(a=>a.id===importAccount)!,hash);importRows(ledger,parsed,from,to);setPreview(parsed);})}/>
       </>}
      {!!preview.length&&<View style={s.explainer}><Text style={s.cardTitle}>Check the dates and signs</Text><Text style={s.body}>{preview.filter(t=>t.date>=from&&t.date<=to).length} rows in your chosen period. Money out is negative.</Text>{preview.filter(t=>t.date>=from&&t.date<=to).map(t=><View key={t.id}><Text style={s.body}>{t.date} · {t.description} · {money(t.amount,t.currency)}</Text>{!!t.evidence&&<Text style={s.meta}>Source: {t.evidence}</Text>}</View>)}<Text style={s.meta}>Check these against your statement, especially amounts, signs, and omitted rows. Exact source repeats are skipped; possible duplicates are held for review.</Text>{extractionWarnings.map((w,i)=><Text key={i} style={s.error}>{w}</Text>)}<Button title="Confirm import" disabled={busy} onPress={confirmImport}/></View>}
     </>}
    </ScrollView>
   </View></KeyboardAvoidingView></SafeAreaView>
  </Modal>
 </SafeAreaView></SafeAreaProvider>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#F6F8FC'},shell:{width:'100%',maxWidth:620,alignSelf:'center',flex:1},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,paddingTop:12,paddingBottom:18,backgroundColor:'#FFF'},
 wordmark:{fontSize:29,fontWeight:'800',letterSpacing:-1.2,color:navy},add:{height:45,width:45,borderRadius:16,backgroundColor:blue,alignItems:'center',justifyContent:'center'},
 content:{padding:24,paddingBottom:40},eyebrow:{fontSize:12,fontWeight:'700',letterSpacing:2,color:blue,marginBottom:10},
 title:{fontSize:31,lineHeight:38,fontWeight:'700',letterSpacing:-1,color:navy,marginBottom:20},
 body:{fontSize:16,lineHeight:24,color:ink,marginBottom:12},meta:{fontSize:13,lineHeight:20,color:muted},
 period:{flexDirection:'row',gap:12},label:{fontSize:14,fontWeight:'600',color:ink,marginBottom:8,marginTop:6},
 input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#D8E0EC',borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:16,color:ink},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},
 chip:{paddingHorizontal:13,paddingVertical:11,borderWidth:1,borderColor:'#D8E0EC',borderRadius:10,backgroundColor:'#FFF'},
 chipSelected:{backgroundColor:blue,borderColor:blue},chipText:{fontSize:14,color:ink},
 countryColumns:{flexDirection:'row',gap:20,marginTop:20,marginBottom:12},
 countryColumn:{flex:1,minWidth:0},countryName:{fontSize:17,fontWeight:'700',color:'#FFFFFF',marginBottom:6},
 countryMetric:{fontSize:11,letterSpacing:1,color:'#BACCE5',marginTop:20,marginBottom:6},
 countryAmount:{fontSize:25,fontWeight:'700',color:'#FFFFFF',letterSpacing:-.5},
 countryValue:{fontSize:20,fontWeight:'600',color:'#FFFFFF'},
 hero:{backgroundColor:navy,borderRadius:24,padding:25,marginTop:3,marginBottom:15},heroLabel:{fontSize:12,letterSpacing:1.5,color:'#BACCE5',fontWeight:'600'},
 heroAmount:{fontSize:42,fontWeight:'700',color:'#FFF',letterSpacing:-1.5,marginTop:10},heroSub:{fontSize:14,color:'#C4D2E5',marginTop:10},
 heroLine:{height:1,backgroundColor:'#39516F',marginVertical:22},heroStats:{flexDirection:'row',justifyContent:'space-between'},heroSmall:{fontSize:23,fontWeight:'600',color:'white',marginTop:8},
 reviewCard:{backgroundColor:'#EAF0FF',borderRadius:16,padding:20,flexDirection:'row',alignItems:'center',gap:12,marginVertical:24},
 cardTitle:{fontSize:17,fontWeight:'600',color:ink,marginBottom:7},sectionTitle:{fontSize:21,fontWeight:'700',color:navy,marginBottom:15},
 familyRow:{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:12,borderBottomWidth:1,borderColor:'#E4EAF2'},
 personIcon:{width:34,height:34,borderRadius:12,backgroundColor:'#E6EDFB',alignItems:'center',justifyContent:'center'},
 between:{flexDirection:'row',justifyContent:'space-between',gap:12},amount:{fontSize:15,fontWeight:'600',color:ink},
 bar:{height:6,backgroundColor:'#E3EAF5',borderRadius:4},barFill:{height:6,backgroundColor:blue,borderRadius:4},
 button:{backgroundColor:blue,borderRadius:12,paddingHorizontal:17,paddingVertical:14,alignItems:'center',marginVertical:6},
 secondary:{backgroundColor:'#EAF0FF'},buttonText:{color:'white',fontSize:15,fontWeight:'600'},
 txRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:17,borderBottomWidth:1,borderColor:'#E3E9F2'},txTitle:{fontSize:16,fontWeight:'600',color:ink,marginBottom:3},
 avatar:{width:40,height:40,borderRadius:14,justifyContent:'center',alignItems:'center'},
 accountCard:{padding:18,backgroundColor:'white',borderRadius:16,marginBottom:14,borderWidth:1,borderColor:'#E1E7F0'},currency:{fontSize:12,fontWeight:'700',color:blue,paddingTop:4},
 explainer:{backgroundColor:'#EAF0FF',padding:18,borderRadius:16,marginVertical:18},empty:{paddingVertical:40,alignItems:'center'},
 nav:{flexDirection:'row',backgroundColor:'white',borderTopWidth:1,borderColor:'#E4EAF2',paddingTop:9,paddingBottom:10},
 navItem:{flex:1,alignItems:'center',padding:6},navIcon:{fontSize:24,color:muted},navLabel:{fontSize:12,color:muted,marginTop:4},
 modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,paddingTop:15},
 error:{color:'#9F2929',backgroundColor:'#FCEBEC',padding:14,borderRadius:10,fontSize:15,marginBottom:18},
 notice:{backgroundColor:'#DEF2EB',color:'#145A48',padding:14,fontSize:14,lineHeight:20},
 previewBanner:{fontSize:12,color:'#6B5818',backgroundColor:'#FFF4C9',padding:9,textAlign:'center'},
 footer:{fontSize:12,color:muted,textAlign:'center',marginTop:35}
});

