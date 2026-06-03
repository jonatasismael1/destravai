import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import type { TourStep } from '../../lib/onboarding/tours'

interface Props {
  steps: TourStep[]
  index: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

type Rect = { top: number; left: number; width: number; height: number }

const SPOTLIGHT_PAD = 8
const GAP = 12

// Overlay de tour: escurece a tela, recorta um "spotlight" no elemento-alvo
// (via box-shadow) e mostra um cartão com título, texto, progresso e botões.
// Sem libs externas — usa os tokens do app, então funciona em dark e light.
export default function TourOverlay({ steps, index, onNext, onPrev, onSkip }: Props) {
  const step = steps[index]
  const total = steps.length
  const isLast = index === total - 1
  const isFirst = index === 0

  const cardRef = useRef<HTMLDivElement>(null)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [cardSize, setCardSize] = useState({ w: 340, h: 180 })
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })

  // Localiza o elemento-alvo (data-tour). Tenta por ~1s, pois a tela pode estar
  // terminando de montar/animar quando o tour dispara.
  useLayoutEffect(() => {
    let raf = 0
    let tries = 0
    const measure = () => {
      if (!step?.target) { setTargetRect(null); return }
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) {
        const r = el.getBoundingClientRect()
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      } else if (tries < 30) {
        tries++
        raf = requestAnimationFrame(measure)
      } else {
        setTargetRect(null) // não achou: vira passo central
      }
    }
    measure()
    return () => cancelAnimationFrame(raf)
  }, [step?.target, index])

  // Acompanha rolagem/resize para o spotlight seguir o elemento.
  useEffect(() => {
    const onMove = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      if (step?.target) {
        const el = document.querySelector(`[data-tour="${step.target}"]`)
        if (el) {
          const r = el.getBoundingClientRect()
          setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }
      }
    }
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [step?.target])

  // Mede o cartão para posicioná-lo corretamente (acima/abaixo do alvo).
  useLayoutEffect(() => {
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect()
      setCardSize({ w: r.width, h: r.height })
    }
  }, [index, targetRect, vp.w, vp.h])

  // Esc pula o tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  // Posição do cartão.
  const cardW = Math.min(360, vp.w - 24)
  let cardLeft = (vp.w - cardW) / 2
  let cardTop = (vp.h - cardSize.h) / 2

  if (targetRect) {
    const spot = {
      top: targetRect.top - SPOTLIGHT_PAD,
      left: targetRect.left - SPOTLIGHT_PAD,
      width: targetRect.width + SPOTLIGHT_PAD * 2,
      height: targetRect.height + SPOTLIGHT_PAD * 2,
    }
    // Abaixo do alvo se couber; senão acima.
    const below = spot.top + spot.height + GAP
    const above = spot.top - GAP - cardSize.h
    cardTop = below + cardSize.h <= vp.h - 12 ? below : Math.max(12, above)
    cardLeft = targetRect.left + targetRect.width / 2 - cardW / 2
    cardLeft = Math.min(Math.max(12, cardLeft), vp.w - cardW - 12)
  }

  const spotlight = targetRect && {
    top: targetRect.top - SPOTLIGHT_PAD,
    left: targetRect.left - SPOTLIGHT_PAD,
    width: targetRect.width + SPOTLIGHT_PAD * 2,
    height: targetRect.height + SPOTLIGHT_PAD * 2,
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 400 }}>
      {/* Dim + spotlight. Quando há alvo, o escurecimento vem do box-shadow gigante
          ao redor do recorte; senão, um dim cheio. */}
      {spotlight ? (
        <div
          style={{
            position: 'fixed',
            top: spotlight.top, left: spotlight.left,
            width: spotlight.width, height: spotlight.height,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            border: '2px solid var(--brand)',
            pointerEvents: 'none',
            transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)' }} />
      )}

      {/* Bloqueia cliques no app por trás (não fecha ao clicar fora — evita sair sem querer). */}
      <div style={{ position: 'fixed', inset: 0 }} />

      {/* Cartão */}
      <div
        ref={cardRef}
        className="absolute"
        style={{
          top: cardTop, left: cardLeft, width: cardW,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 18,
          boxShadow: 'var(--shadow-card)',
          padding: 18,
          transition: 'top 0.25s cubic-bezier(0.22,1,0.36,1), left 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
            {index + 1} de {total}
          </span>
          <button onClick={onSkip} aria-label="Pular tour"
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <h3 className="text-base font-extrabold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
          {step.title}
        </h3>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          {step.body}
        </p>

        <div className="flex items-center gap-2">
          <button onClick={onSkip}
            className="text-xs font-semibold px-2 py-2 mr-auto"
            style={{ color: 'var(--text-muted)' }}>
            Pular tour
          </button>
          {!isFirst && (
            <button onClick={onPrev} className="btn-secondary text-sm px-3 py-2">
              <ChevronLeft size={15} /> Voltar
            </button>
          )}
          <button onClick={onNext} className="btn-primary text-sm px-4 py-2">
            {isLast ? <><Check size={15} /> Concluir</> : <>Próximo <ChevronRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
