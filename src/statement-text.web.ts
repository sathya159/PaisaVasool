import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
export async function statementText(uri:string,name:string){
 const response=await fetch(uri);if(!response.ok)throw Error('Could not open this file.');
 if(!name.toLowerCase().endsWith('.pdf')){const text=await response.text();if(text.length>30000)throw Error('Split statements longer than 30,000 characters.');return text;}
 GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
 const task=getDocument({data:new Uint8Array(await response.arrayBuffer())});
 try{const pdf=await task.promise;if(pdf.numPages>20)throw Error('Please split PDFs longer than 20 pages.');let text='';
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();text+=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('')+'\n';if(text.length>30000)throw Error('Please split this statement into smaller files.');}
  if(text.trim().length<5)throw Error('This PDF is scanned or has no readable text. Use a text-based PDF or CSV; browser OCR is not included.');return text;
 }finally{await task.destroy();}
}

