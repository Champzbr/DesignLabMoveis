const CACHE = 'designlabmoveis-1.100.49';
const APP_SHELL = [
  './',
  './index.html',
  './designlabmoveis-1.100.49.html',
  './manifest.json',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // cache:reload evita copiar uma resposta velha do cache HTTP do navegador.
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
    await Promise.all(
      keys
        .filter(k => k !== CACHE && (k.startsWith('mini-cad-pro-') || k.startsWith('designlabmoveis-')))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CLEAR_OLD_CACHES'){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('mini-cad-pro-')||k.startsWith('designlabmoveis-'))).map(k=>caches.delete(k)));
    })());
  }
});

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;

  // Nunca armazenar dados autenticados, Identity ou APIs.
  if(req.headers.has('Authorization') ||
     url.pathname.startsWith('/.netlify/identity/') ||
     !sameOrigin){
    return;
  }

  const isVersion=url.pathname.endsWith('/version.json');
  const isNavigation=req.mode==='navigate' ||
    url.pathname==='/' ||
    url.pathname.endsWith('/index.html') ||
    /^\/designlabmoveis-[^/]+\.html$/.test(url.pathname);

  if(isVersion){
    event.respondWith(
      fetch(new Request(req,{cache:'no-store'}))
        .catch(()=>caches.match('./version.json'))
    );
    return;
  }

  if(isNavigation){
    // NETWORK FIRST: novas versões aparecem já na primeira abertura.
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(new Request(req,{cache:'no-store'}));
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE);
          await cache.put('./index.html',fresh.clone());
        }
        return fresh;
      }catch{
        return (await caches.match(req)) ||
               (await caches.match('./index.html')) ||
               Response.error();
      }
    })());
    return;
  }

  // Arquivos estáticos locais: abre rápido pelo cache e atualiza em segundo plano.
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const network=fetch(req).then(async response=>{
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(req,response.clone());
      }
      return response;
    }).catch(()=>null);

    if(cached){
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
