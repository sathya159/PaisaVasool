import { emptyLedger } from './ledger';
import type { Ledger } from './ledger';
import {cloudOwner,readCloudLedger,writeCloudLedger} from './cloud';
const localKey='kinledger-device-ledger-v1';
export async function loadLedger(){
 if(cloudOwner())return (await readCloudLedger())||emptyLedger();
 const raw=localStorage.getItem(localKey);
 if(!raw)return emptyLedger();
 const saved=JSON.parse(raw);
 if(saved.version!==1||!Array.isArray(saved.transactions)||!Array.isArray(saved.accounts)||!Array.isArray(saved.rules))throw Error('Saved records could not be read. Do not clear browser storage; recover your backup.');
 return saved as Ledger;
}
export async function saveLedger(value:Ledger){
 if(cloudOwner()){await writeCloudLedger(value);return;}
 localStorage.setItem(localKey,JSON.stringify(value));
}

