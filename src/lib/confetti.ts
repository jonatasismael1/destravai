export function triggerConfetti() {
  if (typeof document === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const width = window.innerWidth
  const height = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)

  const colors = ['#6D5DF6', '#F7B955', '#FF7A6B', '#53D6A1', '#9B8CFF']
  
  interface Particle {
    x: number
    y: number
    size: number
    color: string
    speedX: number
    speedY: number
    rotation: number
    rotationSpeed: number
  }

  const particles: Particle[] = []
  const particleCount = 120

  // Cria confetes subindo das duas pontas inferiores da tela
  for (let i = 0; i < particleCount; i++) {
    const fromLeft = i < particleCount / 2
    particles.push({
      x: fromLeft ? 0 : width,
      y: height - 60,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: fromLeft 
        ? Math.random() * 7 + 5 
        : -(Math.random() * 7 + 5),
      speedY: -(Math.random() * 14 + 11),
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
    })
  }

  const startTime = Date.now()

  function animate() {
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)

    let active = false
    const elapsed = Date.now() - startTime

    particles.forEach(p => {
      p.x += p.speedX
      p.y += p.speedY
      p.speedY += 0.38 // Gravidade
      p.speedX *= 0.98 // Atrito
      p.rotation += p.rotationSpeed

      // Mantém a animação active enquanto houver confetes na tela ou antes do timeout
      if (p.y < height && p.x >= -20 && p.x <= width + 20) {
        active = true
      }

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    })

    if (active && elapsed < 3500) {
      requestAnimationFrame(animate)
    } else {
      canvas.remove()
    }
  }

  animate()
}
