import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);

// A home-screen entry on hosted HTTPS sites; updates load on reopen/refresh.
if (typeof document !== 'undefined') {
 document.title='paisavasool';
 const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/manifest.webmanifest';document.head.appendChild(manifest);
 for(const [name,content] of [['theme-color','#8060ED'],['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-title','paisavasool']]){const meta=document.createElement('meta');meta.name=name;meta.content=content;document.head.appendChild(meta);}
}

