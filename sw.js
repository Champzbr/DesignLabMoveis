const BUILD = '1.312.00-r16';
const CACHE = 'designlabmoveis-' + BUILD;
const APP_SHELL = [
  './',
  './index.html',
  './planoslab.html',
  './supervisor.html',
  './manifest.json',
  './version.json',
  './editor-operador.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/base.css?v=1.312.00-r16',
  './css/editor.css?v=1.312.00-r16',
  './css/materials.css?v=1.312.00-r16',
  './css/labels.css?v=1.312.00-r16',
  './css/cut-plan.css?v=1.312.00-r16',
  './css/layout.css?v=1.312.00-r16',
  './css/projects.css?v=1.312.00-r16',
  './css/settings.css?v=1.312.00-r16',
  './css/home.css?v=1.312.00-r16',
  './css/mobile.css?v=1.312.00-r16',
  './css/home-theme-120066.css?v=1.312.00-r16',
  './js/app.js?v=1.312.00-r16',
  './js/editor-runtime.js?v=1.312.00-r16',
  './js/modules/editor.js?v=1.312.00-r16',
  './js/modules/auth.js?v=1.312.00-r16',
  './js/modules/admin.js?v=1.312.00-r16',
  './js/modules/3d-engine.js?v=1.312.00-r16',
  './js/modules/doors-drawers.js?v=1.312.00-r16',
  './js/modules/cut-plan.js?v=1.312.00-r16',
  './js/modules/projects.js?v=1.312.00-r16',
  './js/modules/machining-shapes.js?v=1.312.00-r16',
  './js/modules/production-materials.js?v=1.312.00-r16',
  './js/modules/curved-furniture.js?v=1.312.00-r16',
  './js/modules/spaces-cuts.js?v=1.312.00-r16',
  './js/modules/tape-movement.js?v=1.312.00-r16',
  './js/modules/camera-navigation.js?v=1.312.00-r16',
  './js/modules/library.js?v=1.312.00-r16',
  './js/modules/cad-io.js?v=1.312.00-r16',
  './js/modules/selection-3d.js?v=1.312.00-r16',
  './js/modules/piece-editor.js?v=1.312.00-r16',
  './js/modules/cut-plan-ui.js?v=1.312.00-r16',
  './js/modules/technical-layout.js?v=1.312.00-r16',
  './js/modules/production-suite.js?v=1.312.00-r16',
  './js/modules/tool-dock.js?v=1.312.00-r16',
  './js/modules/geometry-core.js?v=1.312.00-r16',
  './js/modules/piece-inspector.js?v=1.312.00-r16',
  './js/modules/editor-history.js?v=1.312.00-r16',
  './js/modules/piece-geometry.js?v=1.312.00-r16',
  './js/modules/app-update.js?v=1.312.00-r16',
  './js/modules/cloud-account.js?v=1.312.00-r16',
  './js/modules/ui-overlays.js?v=1.312.00-r16',
  './js/modules/back-navigation.js?v=1.312.00-r16',
  './js/modules/ui-events.js?v=1.312.00-r16',
  './js/modules/runtime-bootstrap.js?v=1.312.00-r16',
  './js/modules/runtime-config.js?v=1.312.00-r16',
  './js/modules/runtime-helpers.js?v=1.312.00-r16',
  './js/modules/app-theme.js?v=1.312.00-r16',
  './js/modules/space-healing.js?v=1.312.00-r16',
  './js/modules/interaction-helpers.js?v=1.312.00-r16',
  './js/modules/production-export-helpers.js?v=1.312.00-r16',
  './js/modules/tool-controller.js?v=1.312.00-r16',
  './js/modules/space-editor.js?v=1.312.00-r16',
  './js/modules/cad-scene.js?v=1.312.00-r16',
  './js/modules/runtime-model.js?v=1.312.00-r16',
  './js/modules/module-registry.js?v=1.312.00-r16',
  './js/modules/cad-input.js?v=1.312.00-r16',
  './js/modules/cad-appearance.js?v=1.312.00-r16',
  './js/modules/curved-ui.js?v=1.312.00-r16',
  './js/qr-local.js?v=1.312.00-r16'
];

const EXTERNAL_SHELL = [
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/lines/LineSegments2.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/lines/LineSegmentsGeometry.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/lines/LineMaterial.js',
  'https://identity.netlify.com/v1/netlify-identity-widget.js'
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
    // 1.200.96: guarda também as dependências externas necessárias ao CAD.
    for(const url of EXTERNAL_SHELL){
      try{
        const noCors=url.includes('identity.netlify.com');
        const req=new Request(url,{mode:noCors?'no-cors':'cors',cache:'reload'});
        const res=await fetch(req);
        if(res&&(res.ok||res.type==='opaque'))await cache.put(req,res.clone());
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
      const purgeAll=event.data?.type==='PURGE_APP_CACHE';
      await Promise.all(keys.filter(k=>(purgeAll||k!==CACHE)&&(k.startsWith('mini-cad-pro-')||k.startsWith('designlabmoveis-'))).map(k=>caches.delete(k)));
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

async function externalCacheFirst(req){
  const cached=await caches.match(req);
  if(cached)return cached;
  try{
    const res=await fetch(req);
    if(res&&(res.ok||res.type==='opaque')){const cache=await caches.open(CACHE);await cache.put(req,res.clone());}
    return res;
  }catch{return Response.error();}
}

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const sameOrigin=url.origin===self.location.origin;
  const isThreeCdn=url.origin==='https://unpkg.com'&&url.pathname.startsWith('/three@0.160.0/');
  const isIdentityWidget=url.origin==='https://identity.netlify.com'&&url.pathname==='/v1/netlify-identity-widget.js';
  if(isThreeCdn||isIdentityWidget){event.respondWith(externalCacheFirst(req));return;}
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
