import {File} from 'expo-file-system';
export async function statementText(uri:string,name:string){if(name.toLowerCase().endsWith('.pdf'))throw Error('Use the native Apple statement reader for PDFs, or import a CSV here.');return new File(uri).text();}

