/* Sin caché de contenido privado: toda lectura exige red y sesión vigente. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="es-CL"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><body><h1>No hay conexión</h1><p>Vuelva a conectarse para consultar su intranet de forma segura.</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
