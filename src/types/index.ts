export interface User {
  id: string
  name: string
  email: string
  createdAt: string
  plan: 'destravai_completo'
  onboardingCompleted: boolean
}

export interface ProfessionalProfile {
  professionalName: string
  specialty: string
  city: string
  targetAudience: string
  instagram: string
  serviceType: string
  currentGoal: string
  exposureLevel: ExposureLevel
  voiceTone: string[]
  pillars: ContentPillar[]
  services: ServiceTopic[]
  limits: Limits
  catchphrase: string
  preferredWords: string[]
  avoidedWords: string[]
  availableMoments: string[]
  // Campos da Essência que personalizam ainda mais o conteúdo (opcionais para não
  // quebrar quem constrói o perfil sem eles, ex.: onboarding inicial).
  differentials?: string          // o que diferencia este profissional
  frequentQuestions?: string[]    // dúvidas que o público sempre faz
  commonObjections?: string[]     // objeções a quebrar antes da venda
  positioning?: string            // posicionamento sintetizado pela IA (ai_positioning)
}

export type ExposureLevel =
  | 'no-appearance'
  | 'appear-no-talk'
  | 'short-videos'
  | 'comfortable-talking'
  | 'humor-backstage'

export interface ContentPillar {
  id: string
  name: string
  description: string
  priority: number
}

export interface ServiceTopic {
  id: string
  name: string
  category: string
  commercialGoal: string
}

export interface Limits {
  avoidTopics: string[]
  sensitiveMatter: string[]
  noTeamShow: boolean
  noOfficeShow: boolean
  humorRestrictions: string
}

export interface ContentIdea {
  id: string
  type: 'story' | 'sequence' | 'reel'
  theme: string
  objective: string
  content: string
  cta: string
  timeEstimate: string
  exposureLevel: ExposureLevel
  status: 'pending' | 'saved' | 'done' | 'skipped'
  favorite: boolean
  createdAt: string
  tags: string[]
}

export interface Mission {
  id: string
  title: string
  description: string
  type: 'story' | 'sequence' | 'reel'
  status: 'pending' | 'done' | 'skipped'
  date: string
  content: ContentIdea | null
  points: number
}

export interface Progress {
  missionsCompleted: number
  currentStreak: number
  weeklyMissions: number
  contentBalance: {
    authority: number
    backstage: number
    connection: number
    sale: number
    interaction: number
    humor: number
  }
  lastActivity: string
  level: string
  /** Maior sequência já atingida. */
  bestStreak: number
  /** Escudos que protegem a sequência de zerar ao pular 1 dia. */
  streakShields: number
}

export interface PersonalContext {
  nickname?: string
  lifeMoment?: string
  hobbies?: string[]
  personalValues?: string[]
  motivations?: string
  setupCompleted?: boolean
  setupSkipped?: boolean
}

export interface JournalEntry {
  id: string
  content: string
  mood: string
  date: string
  tags?: string[]
}

export interface PersonalIdea {
  id: string
  content: string
  category: 'conteúdo' | 'pessoal' | 'livre'
  createdAt: string
}

export interface PersonalSpace {
  context: PersonalContext
  journal: JournalEntry[]
  ideas: PersonalIdea[]
  todayMood?: string
  todayMoodNote?: string
  todayMoodDate?: string
}

export interface AppState {
  user: User | null
  profile: ProfessionalProfile | null
  ideas: ContentIdea[]
  missions: Mission[]
  progress: Progress
  personalSpace: PersonalSpace
}

export interface GenerateRequest {
  type: 'story' | 'sequence' | 'reel'
  theme: string
  objective: string
  format?: string
  exposureLevel: ExposureLevel
  timeAvailable: string
  tone: string[]
  profile: ProfessionalProfile
}
