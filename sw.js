const BUILD = '1.200.24-r1';
const CACHE = 'designlabmoveis-' + BUILD;
const APP_SHELL = [
  './',
  './index.html',
  './designlabmoveis-1.200.24.html',
  './manifest.json',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/base.css?v=1.200.24-r1',
  './css/editor.css?v=1.200.24-r1',
  './css/materials.css?v=1.200.24-r1',
  './css/labels.css?v=1.200.24-r1',
  './css/cut-plan.css?v=1.200.24-r1',
  './css/layout.css?v=1.200.24-r1',
  './css/projects.css?v=1.200.24-r1',
  './css/settings.css?v=1.200.24-r1',
  './css/home.css?v=1.200.24-r1',
  './css/mobile.css?v=1.200.24-r1',
  './js/app.js?v=1.200.24-r1'
];

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of APP_SHELL){
      try{
        const req=new Request(url,{cache:'reload'});
        const res=await fetch(req);
        if(res&&res.ok)await cache.put(req,res.clone());
      }catch{}
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && (k.startsWith('mini-cad-pro-') || k.startsWith('designlabmoveis-'))).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CLEAR_OLD_CACHES' || event.data?.type==='PURGE_APP_CACHE'){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('mini-cad-pro-')||k.startsWith('designlabmoveis-'))).map(k=>caches.delete(k)));
    })());
  }
});

async function networkFirst(req){
  try{
    const fresh=await fetch(new Request(req,{cache:'no-cache'}));
    if(fresh&&fresh.ok){const cache=await caches.open(CACHE);await cache.put(req,fresh.clone());}
    return fresh;
  }catch{
    return (await caches.match(req)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  if(req.headers.has('Authorization') || url.pathname.startsWith('/.netlify/identity/') || !sameOrigin)return;

  const isVersion=url.pathname.endsWith('/version.json');
  const isNavigation=req.mode==='navigate' || url.pathname==='/' || url.pathname.endsWith('/index.html') || /^\/designlabmoveis-[^/]+\.html$/.test(url.pathname);
  const isCode=url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/') || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/sw.js');

  if(isVersion){
    event.respondWith(fetch(new Request(req,{cache:'no-store'})).catch(()=>caches.match(req)));
    return;
  }
  // HTML e código do aplicativo são sempre rede-primeiro quando houver internet.
  // Isso impede o PWA instalado de misturar HTML novo com JS/CSS antigo.
  if(isNavigation || isCode){
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const network=fetch(req).then(async response=>{
      if(response&&response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone());}
      return response;
    }).catch(()=>null);
    if(cached){event.waitUntil(network);return cached;}
    return (await network) || Response.error();
  })());
});
