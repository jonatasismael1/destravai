import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'
import type { DestravaiProfile, BrandEssence } from '../lib/supabase/types'
import type { ContentIdea, Mission, Progress, PersonalSpace, PersonalContext, JournalEntry, PersonalIdea, ProfessionalProfile } from '../types'
import { calculateStreak, calculateLevel, getWeekKey, inferCategory } from '../lib/progress'
import { getCurrentProfile } from '../services/profileService'

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
  })

  // Sincronizar sessão do Supabase e buscar profile ao carregar
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Buscar profile imediatamente para que onboarding_completed esteja disponível
        const profile = await getCurrentProfile().catch(() => null)
        setState(s => ({
          ...s,
          supabaseUser: session.user,
          session,
          profile,
          authLoading: false,
        }))
      } else {
        setState(s => ({ ...s, supabaseUser: null, session: null, authLoading: false }))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await getCurrentProfile().catch(() => null)
        setState(s => ({
          ...s,
          supabaseUser: session.user,
          session,
          profile,
          authLoading: false,
        }))
      } else {
        setState(s => ({
          ...s,
          supabaseUser: null,
          session: null,
          authLoading: false,
          profile: null,
          essence: null,
        }))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Persistir progresso em localStorage (dados de UI)
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress))
  }, [state.progress])

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

  const addMission = (mission: Mission) =>
    setState(s => ({ ...s, missions: [mission, ...s.missions] }))

  const updateMission = (id: string, updates: Partial<Mission>) =>
    setState(s => ({ ...s, missions: s.missions.map(m => m.id === id ? { ...m, ...updates } : m) }))

  const updateProgress = (updates: Partial<Progress>) =>
    setState(s => ({ ...s, progress: { ...s.progress, ...updates } }))

  const completeMission = (ideaObjective: string) => {
    setState(s => {
      const newCompleted = s.progress.missionsCompleted + 1
      const newWeekly = s.progress.weeklyMissions + 1
      const newStreak = calculateStreak(s.progress.lastActivity, s.progress.currentStreak)
      const newLevel = calculateLevel(newCompleted)
      const category = inferCategory(ideaObjective)
      const newBalance = {
        ...s.progress.contentBalance,
        [category]: (s.progress.contentBalance[category as keyof typeof s.progress.contentBalance] ?? 0) + 1,
      }
      return {
        ...s,
        progress: {
          ...s.progress,
          missionsCompleted: newCompleted,
          weeklyMissions: newWeekly,
          currentStreak: newStreak,
          level: newLevel,
          contentBalance: newBalance,
          lastActivity: new Date().toISOString(),
        },
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
    })
  }

  const savePersonalContext = (context: PersonalContext) =>
    setState(s => ({ ...s, personalSpace: { ...s.personalSpace, context } }))

  const setTodayMood = (mood: string, note?: string) =>
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        todayMood: mood,
        todayMoodNote: note,
        todayMoodDate: new Date().toDateString(),
      },
    }))

  const addJournalEntry = (entry: JournalEntry) =>
    setState(s => ({
      ...s,
      personalSpace: { ...s.personalSpace, journal: [entry, ...s.personalSpace.journal] },
    }))

  const deleteJournalEntry = (id: string) =>
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        journal: s.personalSpace.journal.filter(e => e.id !== id),
      },
    }))

  const addPersonalIdea = (idea: PersonalIdea) =>
    setState(s => ({
      ...s,
      personalSpace: { ...s.personalSpace, ideas: [idea, ...s.personalSpace.ideas] },
    }))

  const deletePersonalIdea = (id: string) =>
    setState(s => ({
      ...s,
      personalSpace: {
        ...s.personalSpace,
        ideas: s.personalSpace.ideas.filter(i => i.id !== id),
      },
    }))

  return (
    <AppContext.Provider value={{
      state, setProfile, setLocalProfile, setEssence, addIdea, updateIdea,
      addMission, updateMission, updateProgress, completeMission, logout,
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
