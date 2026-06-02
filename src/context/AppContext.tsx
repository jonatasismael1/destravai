import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'
import type { DestravaiProfile, BrandEssence } from '../lib/supabase/types'
import type { ContentIdea, Mission, Progress, PersonalSpace, PersonalContext, JournalEntry, PersonalIdea, ProfessionalProfile } from '../types'
import { calculateStreakWithShield, calculateLevel, getWeekKey, inferCategory } from '../lib/progress'
import { getCurrentProfile } from '../services/profileService'
import { getBrandEssence, essenceToProfile } from '../services/essenceService'
import { getSubscriptionStatus, type SubscriptionStatus } from '../services/subscriptionService'
import {
  createJournalEntry as createStoredJournalEntry,
  createPersonalIdea as createStoredPersonalIdea,
  deleteJournalEntry as deleteStoredJournalEntry,
  deletePersonalIdea as deleteStoredPersonalIdea,
  loadPersonalSpace,
  loadStoredMissions,
  loadStoredProgress,
  toISODateKey,
  updateStoredMission,
  upsertPersonalContext,
  upsertStoredMission,
  upsertStoredProgress,
  upsertTodayMood,
} from '../services/userJourneyService'

// ─── Chaves de armazenamento ──────────────────────────────────
// Apenas dados de UI (tema, progresso, perfil local para IA) ficam em localStorage.
// Dados críticos (essência, biblioteca, conversas) vivem no Supabase.

const WEEK_KEY = 'destravai-week'
const PROGRESS_KEY = 'destravai-progress'
// Perfil local: mantido por compatibilidade com chamadas de IA legadas (lib/ai.ts)
// Será removido quando todas as chamadas de IA migrarem para Edge Functions.
const LOCAL_PROFILE_KEY = 'destravai-local-profile'

const defaultProgress: Progress = {
  missionsCompleted: 0,
  currentStreak: 0,
  weeklyMissions: 0,
  contentBalance: { authority: 0, backstage: 0, connection: 0, sale: 0, interaction: 0, humor: 0 },
  lastActivity: new Date().toISOString(),
  level: 'Começando a aparecer',
  bestStreak: 0,
  streakShields: 0,
}

const defaultPersonalSpace: PersonalSpace = {
  context: {},
  journal: [],
  ideas: [],
}

interface AppState {
  // Auth (Supabase)
  supabaseUser: SupabaseUser | null
  session: Session | null
  profile: DestravaiProfile | null
  essence: BrandEssence | null

  // Compatibilidade com chamadas de IA legadas (lib/ai.ts)
  // Mantém o ProfessionalProfile em localStorage para não quebrar Home/Criar enquanto migram.
  localProfile: ProfessionalProfile | null

  // UI / sessão local (pode ficar em localStorage)
  ideas: ContentIdea[]
  missions: Mission[]
  progress: Progress
  personalSpace: PersonalSpace
  authLoading: boolean
  // Carregando profile/essência do banco após resolver a sessão.
  // Separado de authLoading para evitar deadlock no callback de auth do Supabase.
  profileLoading: boolean

  // Assinatura (controle de acesso pago via Asaas)
  subscription: SubscriptionStatus | null
  subscriptionLoading: boolean
}

interface AppContextType {
  state: AppState
  setProfile: (profile: DestravaiProfile | null) => void
  setLocalProfile: (profile: ProfessionalProfile | null) => void
  setEssence: (essence: BrandEssence | null) => void
  addIdea: (idea: ContentIdea) => void
  updateIdea: (id: string, updates: Partial<ContentIdea>) => void
  addMission: (mission: Mission) => void
  updateMission: (id: string, updates: Partial<Mission>) => void
  updateProgress: (updates: Partial<Progress>) => void
  completeMission: (ideaObjective: string) => void
  refreshSubscription: () => Promise<void>
  logout: () => Promise<void>
  savePersonalContext: (context: PersonalContext) => void
  setTodayMood: (mood: string, note?: string) => void
  addJournalEntry: (entry: JournalEntry) => void
  deleteJournalEntry: (id: string) => void
  addPersonalIdea: (idea: PersonalIdea) => void
  deletePersonalIdea: (id: string) => void
}

const AppContext = createContext<AppContextType | null>(null)

function loadProgress(): Progress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY)
    if (!stored) return defaultProgress
    const parsed = JSON.parse(stored) as Progress

    const storedWeek = localStorage.getItem(WEEK_KEY)
    const currentWeek = getWeekKey()
    if (storedWeek !== currentWeek) {
      localStorage.setItem(WEEK_KEY, currentWeek)
      return { ...parsed, weeklyMissions: 0 }
    }
    return parsed
  } catch {
    return defaultProgress
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    supabaseUser: null,
    session: null,
    profile: null,
    essence: null,
    localProfile: (() => {
      try { return JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY) ?? 'null') } catch { return null }
    })(),
    ideas: [],
    missions: [],
    progress: loadProgress(),
    personalSpace: defaultPersonalSpace,
    authLoading: true,
    profileLoading: true,
    subscription: null,
    subscriptionLoading: true,
  })

  // 1) Resolve a sessão. IMPORTANTE: o callback do onAuthStateChange deve ser
  // SÍNCRONO. Chamar métodos do supabase (getUser, queries) aqui dentro trava
  // o cliente de auth (deadlock) — por isso a busca de dados fica no efeito 2.
  useEffect(() => {
    // Rede segura: se getSession falhar ou travar (token corrompido no PWA, rede
    // instável), nunca deixamos o app preso no spinner — liberamos a tela de login.
    let settled = false
    const stopSpinner = () => { settled = true; setState(s => (s.authLoading ? { ...s, authLoading: false } : s)) }
    const timeout = setTimeout(() => { if (!settled) stopSpinner() }, 8000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        settled = true
        setState(s => ({
          ...s,
          supabaseUser: session?.user ?? null,
          session,
          authLoading: false,
        }))
      })
      .catch(() => stopSpinner())
      .finally(() => clearTimeout(timeout))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({
        ...s,
        supabaseUser: session?.user ?? null,
        session,
        authLoading: false,
        // Ao deslogar, limpa dados sensíveis da sessão
        profile: session ? s.profile : null,
        essence: session ? s.essence : null,
        localProfile: session ? s.localProfile : null,
      }))
    })

    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  // 2) Quando o usuário muda, busca profile + essência do banco (fora do lock do
  // auth) e reconstrói o localProfile a partir da essência — assim o app funciona
  // em qualquer dispositivo, não só onde o onboarding foi preenchido.
  useEffect(() => {
    const userId = state.supabaseUser?.id
    if (!userId) {
      setState(s => ({ ...s, profileLoading: false, subscriptionLoading: false }))
      return
    }

    let cancelled = false
    setState(s => ({ ...s, profileLoading: true, subscriptionLoading: true }))

    ;(async () => {
      const localProgress = loadProgress()
      const [profile, essence, subscription, progress, missions, personalSpace] = await Promise.all([
        getCurrentProfile().catch(() => null),
        getBrandEssence().catch(() => null),
        getSubscriptionStatus().catch(() => null),
        loadStoredProgress(localProgress).catch(err => {
          console.error('[AppContext progress]', err)
          return localProgress
        }),
        loadStoredMissions().catch(err => {
          console.error('[AppContext missions]', err)
          return []
        }),
        loadPersonalSpace(defaultPersonalSpace).catch(err => {
          console.error('[AppContext personal space]', err)
          return defaultPersonalSpace
        }),
      ])
      if (cancelled) return
      setState(s => {
        const rebuilt = essence ? essenceToProfile(essence, profile?.name ?? '') : null
        if (rebuilt) localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(rebuilt))
        return {
          ...s,
          profile,
          essence,
          localProfile: rebuilt ?? s.localProfile,
          missions,
          progress,
          personalSpace,
          subscription,
          profileLoading: false,
          subscriptionLoading: false,
        }
      })
    })()

    return () => { cancelled = true }
  }, [state.supabaseUser?.id])

  const refreshSubscription = async () => {
    const subscription = await getSubscriptionStatus().catch(() => null)
    setState(s => ({ ...s, subscription }))
  }

  const setProfile = (profile: DestravaiProfile | null) =>
    setState(s => ({ ...s, profile }))

  const setLocalProfile = (localProfile: ProfessionalProfile | null) => {
    if (localProfile) localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile))
    else localStorage.removeItem(LOCAL_PROFILE_KEY)
    setState(s => ({ ...s, localProfile }))
  }

  const setEssence = (essence: BrandEssence | null) =>
    setState(s => ({ ...s, essence }))

  const addIdea = (idea: ContentIdea) =>
    setState(s => ({ ...s, ideas: [idea, ...s.ideas] }))

  const updateIdea = (id: string, updates: Partial<ContentIdea>) =>
    setState(s => ({ ...s, ideas: s.ideas.map(i => i.id === id ? { ...i, ...updates } : i) }))

  const addMission = (mission: Mission) => {
    setState(s => ({ ...s, missions: [mission, ...s.missions] }))
    void upsertStoredMission(mission).catch(err => console.error('[AppContext add mission]', err))
  }

  const updateMission = (id: string, updates: Partial<Mission>) => {
    setState(s => ({ ...s, missions: s.missions.map(m => m.id === id ? { ...m, ...updates } : m) }))
    void updateStoredMission(id, updates).catch(err => console.error('[AppContext update mission]', err))
  }

  const updateProgress = (updates: Partial<Progress>) =>
    setState(s => {
      const progress = { ...s.progress, ...updates }
      void upsertStoredProgress(progress).catch(err => console.error('[AppContext update progress]', err))
      return { ...s, progress }
    })

  const completeMission = (ideaObjective: string) => {
    setState(s => {
      const newCompleted = s.progress.missionsCompleted + 1
      const newWeekly = s.progress.weeklyMissions + 1
      // Streak com escudo: pular 1 dia não zera se houver escudo; a cada 7 dias
      // seguidos ganha um escudo novo.
      const streakResult = calculateStreakWithShield(
        s.progress.lastActivity,
        s.progress.currentStreak,
        s.progress.streakShields ?? 0,
      )
      const newLevel = calculateLevel(newCompleted)
      const category = inferCategory(ideaObjective)
      const newBalance = {
        ...s.progress.contentBalance,
        [category]: (s.progress.contentBalance[category as keyof typeof s.progress.contentBalance] ?? 0) + 1,
      }
      const progress = {
        ...s.progress,
        missionsCompleted: newCompleted,
        weeklyMissions: newWeekly,
        currentStreak: streakResult.streak,
        streakShields: streakResult.shields,
        bestStreak: Math.max(s.progress.bestStreak ?? 0, streakResult.streak),
        level: newLevel,
        contentBalance: newBalance,
        lastActivity: new Date().toISOString(),
      }
      void upsertStoredProgress(progress).catch(err => console.error('[AppContext complete mission]', err))
      return {
        ...s,
        progress,
      }
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(PROGRESS_KEY)
    localStorage.removeItem(WEEK_KEY)
    localStorage.removeItem(LOCAL_PROFILE_KEY)
    setState({
      supabaseUser: null,
      session: null,
      profile: null,
      essence: null,
      localProfile: null,
      ideas: [],
      missions: [],
      progress: defaultProgress,
      personalSpace: defaultPersonalSpace,
      authLoading: false,
      profileLoading: false,
      subscription: null,
      subscriptionLoading: false,
    })
  }

  const savePersonalContext = (context: PersonalContext) => {
    setState(s => ({ ...s, personalSpace: { ...s.personalSpace, context } }))
    void upsertPersonalContext(context).catch(err => console.error('[AppContext personal context]', err))
  }

  const setTodayMood = (mood: string, note?: string) => {
    const today = toISODateKey()
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        todayMood: mood,
        todayMoodNote: note,
        todayMoodDate: today,
      },
    }))
    void upsertTodayMood(mood, note, today).catch(err => console.error('[AppContext today mood]', err))
  }

  const addJournalEntry = (entry: JournalEntry) => {
    setState(s => ({
      ...s,
      personalSpace: { ...s.personalSpace, journal: [entry, ...s.personalSpace.journal] },
    }))
    void createStoredJournalEntry(entry).catch(err => console.error('[AppContext add journal]', err))
  }

  const deleteJournalEntry = (id: string) => {
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        journal: s.personalSpace.journal.filter(e => e.id !== id),
      },
    }))
    void deleteStoredJournalEntry(id).catch(err => console.error('[AppContext delete journal]', err))
  }

  const addPersonalIdea = (idea: PersonalIdea) => {
    setState(s => ({
      ...s,
      personalSpace: { ...s.personalSpace, ideas: [idea, ...s.personalSpace.ideas] },
    }))
    void createStoredPersonalIdea(idea).catch(err => console.error('[AppContext add personal idea]', err))
  }

  const deletePersonalIdea = (id: string) => {
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        ideas: s.personalSpace.ideas.filter(i => i.id !== id),
      },
    }))
    void deleteStoredPersonalIdea(id).catch(err => console.error('[AppContext delete personal idea]', err))
  }

  return (
    <AppContext.Provider value={{
      state, setProfile, setLocalProfile, setEssence, addIdea, updateIdea,
      addMission, updateMission, updateProgress, completeMission, refreshSubscription, logout,
      savePersonalContext, setTodayMood,
      addJournalEntry, deleteJournalEntry,
      addPersonalIdea, deletePersonalIdea,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
