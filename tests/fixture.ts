import {emptyLedger as fresh,accounts} from '../src/ledger.ts';
export * from '../src/ledger.ts';
export const emptyLedger=():import('../src/ledger.ts').Ledger=>({...fresh(),accountSetupVersion:undefined,autoClassifyKnown:false,accounts:[...accounts]});

