import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from './AppContext'
import { updateOnboardingStatus } from '../services/profileService'
import type { OnboardingStatus, TourScreen } from '../lib/supabase/types'
import { TOURS, TOUR_VERSION } from '../lib/onboarding/tours'
import TourOverlay from '../components/onboarding/TourOverlay'

interface OnboardingContextType {
  /** Inicia o tour se o usuário for elegível (essência feita, ainda não viu). */
  maybeStartTour: (screen: TourScreen) => void
  /** Força a abertura de um tour (usado pelo "Ver tour novamente"). */
  startTour: (screen: TourScreen) => void
  /** Zera o progresso de todos os tours e reabre o principal. */
  resetTours: () => void
  activeScreen: TourScreen | null
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { state, setProfile } = useApp()
  const profile = state.profile
  const status: OnboardingStatus = profile?.onboarding_status ?? {}

  // Só mostramos o tour depois que a essência existe (foi preenchida).
  const hasEssence = !!state.essence || !!profile?.essence_completed

  const [active, setActive] = useState<{ screen: TourScreen; index: number } | null>(null)

  // Espelho dos valores vivos, para o maybeStartTour (chamado dentro de setTimeout)
  // não usar um estado defasado por causa de closure.
  const live = useRef({ status, hasEssence, active, profile })
  live.current = { status, hasEssence, active, profile }

  const isDone = useCallback((s: TourScreen, st: OnboardingStatus) =>
    st.tour_version === TOUR_VERSION && st[s] === true, [])

  // Persiste mesclando com o que já existe. Atualização otimista no estado local
  // para a UI responder na hora; se o banco falhar, o app não quebra.
  const persist = useCallback((patch: OnboardingStatus, replace = false) => {
    const base = replace ? {} : (live.current.profile?.onboarding_status ?? {})
    const merged: OnboardingStatus = { ...base, ...patch, tour_version: TOUR_VERSION }
    const p = live.current.profile
    if (p) setProfile({ ...p, onboarding_status: merged })
    void updateOnboardingStatus(merged)
      .then(updated => setProfile(updated))
      .catch(err => console.error('[onboarding] falha ao salvar status', err))
  }, [setProfile])

  const startTour = useCallback((screen: TourScreen) => {
    if (TOURS[screen]?.length) setActive({ screen, index: 0 })
  }, [])

  const maybeStartTour = useCallback((screen: TourScreen) => {
    const l = live.current
    if (l.active) return                 // já tem um tour rodando
    if (!l.hasEssence) return            // essência ainda não preenchida
    if (isDone(screen, l.status)) return // já visto nesta versão
    // Tours de tela só aparecem depois do tour principal (evita empilhar na Home).
    if (screen !== 'main' && !isDone('main', l.status)) return
    if (!TOURS[screen]?.length) return
    setActive({ screen, index: 0 })
  }, [isDone])

  const finish = useCallback((screen: TourScreen) => {
    persist({ [screen]: true })
    setActive(null)
  }, [persist])

  const handleNext = useCallback(() => {
    setActive(curr => {
      if (!curr) return null
      const last = TOURS[curr.screen].length - 1
      if (curr.index >= last) { finish(curr.screen); return null }
      return { ...curr, index: curr.index + 1 }
    })
  }, [finish])

  const handlePrev = useCallback(() => {
    setActive(curr => curr ? { ...curr, index: Math.max(0, curr.index - 1) } : null)
  }, [])

  const handleSkip = useCallback(() => {
    setActive(curr => { if (curr) finish(curr.screen); return null })
  }, [finish])

  const resetTours = useCallback(() => {
    persist({}, true)        // zera tudo (mantém só a versão)
    setActive(null)
    // Reabre o tour principal logo em seguida.
    setTimeout(() => setActive({ screen: 'main', index: 0 }), 120)
  }, [persist])

  const value: OnboardingContextType = {
    maybeStartTour, startTour, resetTours, activeScreen: active?.screen ?? null,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {active && (
        <TourOverlay
          steps={TOURS[active.screen]}
          index={active.index}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
        />
      )}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding precisa do OnboardingProvider')
  return ctx
}

// Dispara o tour da tela na primeira visita (após pequena espera para a tela
// terminar de montar/animar e os alvos existirem).
export function useScreenTour(screen: TourScreen) {
  const { maybeStartTour } = useOnboarding()
  useEffect(() => {
    const t = setTimeout(() => maybeStartTour(screen), 650)
    return () => clearTimeout(t)
  }, [screen, maybeStartTour])
}
