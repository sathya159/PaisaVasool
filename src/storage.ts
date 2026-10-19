import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { emptyLedger } from './ledger';
import type { Ledger } from './ledger';
let db:SQLite.SQLiteDatabase;
export async function loadLedger():Promise<Ledger> {
  db=await SQLite.openDatabaseAsync('kinledger.db');
  const cipher=await db.getFirstAsync<Record<string,string>>('PRAGMA cipher_version');
  if(!cipher || !Object.values(cipher).some(Boolean)) throw new Error('This app needs an iOS development build with encrypted storage. Expo Go is not supported.');
  let key=await SecureStore.getItemAsync('kinledger-db-key');
  if(!key) {
    key=Array.from(await Crypto.getRandomBytesAsync(32)).map(n=>n.toString(16).padStart(2,'0')).join('');
    await SecureStore.setItemAsync('kinledger-db-key',key,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  }
  if(!/^[a-f0-9]{64}$/.test(key))throw new Error('Storage key is invalid.');
  await db.execAsync(`PRAGMA key = "x'${key}'"; CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id=1), value TEXT NOT NULL);`);
  const record=await db.getFirstAsync<{value:string}>('SELECT value FROM ledger WHERE id=1');
  if(!record)return emptyLedger();
  const data=JSON.parse(record.value) as Ledger;
  if(data.version!==1||!Array.isArray(data.transactions))throw new Error('Unsupported ledger version.');
  return data;
}
export async function saveLedger(value:Ledger) {
  if(!db)throw new Error('Storage is not ready.');
  await db.runAsync('INSERT INTO ledger(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',JSON.stringify(value));
}

