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

// ── Menu mobile: rola até os planos ─────────────────────
const menuToggle = document.getElementById('menuToggle')
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    document.getElementById('planos').scrollIntoView({ behavior: 'smooth' })
  })
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
