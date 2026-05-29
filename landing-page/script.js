// ── Header: fundo ao rolar ──────────────────────────────
const header = document.getElementById('header')
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24)
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

// ── Revelação por scroll (IntersectionObserver) ─────────
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in')
        io.unobserve(e.target)
      }
    })
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
)
document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

// ── FAQ accordion ───────────────────────────────────────
document.querySelectorAll('.faq-q').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item')
    const answer = item.querySelector('.faq-a')
    const isOpen = item.classList.contains('open')

    // Fecha os demais
    document.querySelectorAll('.faq-item.open').forEach((other) => {
      if (other !== item) {
        other.classList.remove('open')
        other.querySelector('.faq-a').style.maxHeight = null
      }
    })

    if (isOpen) {
      item.classList.remove('open')
      answer.style.maxHeight = null
    } else {
      item.classList.add('open')
      answer.style.maxHeight = answer.scrollHeight + 'px'
    }
  })
})

// ── Menu mobile (sidebar) ───────────────────────────────
const menuToggle = document.getElementById('menuToggle')
const mobileMenu = document.getElementById('mobileMenu')
const mobileOverlay = document.getElementById('mobileOverlay')
const menuClose = document.getElementById('menuClose')

function openMenu() {
  mobileMenu.classList.add('open')
  mobileOverlay.classList.add('open')
  mobileMenu.setAttribute('aria-hidden', 'false')
  menuToggle?.setAttribute('aria-expanded', 'true')
  document.body.style.overflow = 'hidden'
}
function closeMenu() {
  mobileMenu.classList.remove('open')
  mobileOverlay.classList.remove('open')
  mobileMenu.setAttribute('aria-hidden', 'true')
  menuToggle?.setAttribute('aria-expanded', 'false')
  document.body.style.overflow = ''
}

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', openMenu)
  menuClose?.addEventListener('click', closeMenu)
  mobileOverlay?.addEventListener('click', closeMenu)
  // Fecha ao clicar em qualquer link do menu
  mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu))
}

// ── Âncoras suaves (fallback p/ navegadores sem smooth) ──
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')
    if (id.length > 1) {
      const target = document.querySelector(id)
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth' })
      }
    }
  })
})
