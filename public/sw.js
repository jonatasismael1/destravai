// Service Worker do Destravaí
// Objetivo: tornar o app instalável (PWA) e funcionar offline de forma básica.
// Estratégia: network-first para conteúdo do próprio site (sempre busca a versão
// mais nova; só usa cache quando está offline). Requisições para outros domínios
// (Supabase, Gemini, fontes) passam direto, sem interferência.

const CACHE = 'destravai-v12'
const SHELL = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Caminhos dinâmicos que NUNCA devem ser cacheados (dados sempre frescos):
// funções Netlify (checkout, status de assinatura, IA, webhook) e rotas de auth.
// Cachear isso causava status de assinatura/checkout desatualizado e "login preso".
function isDynamic(pathname) {
  return (
    pathname.startsWith('/.netlify/functions/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Só intercepta GET do próprio domínio. APIs (Supabase/Gemini) passam direto.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Conteúdo dinâmico (funções/assinatura/auth): deixa o navegador buscar direto,
  // sem cache do SW. Evita servir status de pagamento/sessão desatualizado.
  if (isDynamic(url.pathname)) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/index.html'))
      )
  )
})
