// Only known aliases are changed here; unfamiliar business/person names remain intact.
export function canonicalMerchant(name:string){
 const key=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 if(['chickfila','chickfilas','chickfilae','chickfilaes','chicfila','chikfila','chickfilla'].includes(key))return 'Chick-fil-A';
 return name.trim();
}

