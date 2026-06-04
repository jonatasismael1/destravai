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
  // Dados pessoais que personalizam o conteúdo e evitam erro de gênero. Opcionais.
  pronoun?: Pronoun               // como a pessoa se identifica (concordância de gênero)
  personalNotes?: string          // contexto pessoal livre (filhos, cidade, estado civil…)
  sharePersonal?: boolean         // topa usar a vida pessoal para humanizar o conteúdo
}

// Como a pessoa se identifica — usado para a IA fazer a concordância de gênero
// correta (evita "esta profissional" para um homem, por exemplo).
export type Pronoun = 'ele' | 'ela' | 'neutro'

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
  contentType?: ContentType
  sequenceCount?: number | null
  model?: ContentModel | null
  theme: string
  objective: string
  objectiveKey?: ContentObjective
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
  contentType?: ContentType
  sequenceCount?: number | null
  theme: string
  objective: ContentObjective | string
  objectiveLabel?: string
  model?: ContentModel | null
  format?: string
  exposureLevel: ExposureLevel
  timeAvailable: string
  tone: string[]
  profile: ProfessionalProfile
}

export type ContentType = 'single_story' | 'story_sequence' | 'short_reel'

export type ContentModel =
  | 'question_box'
  | 'poll'
  | 'backstage'
  | 'myth_truth'
  | 'quick_question'
  | 'soft_sell'
  | 'objection_break'

export type ContentObjective =
  | 'educate'
  | 'connect'
  | 'sell_service'
  | 'promote_product'
  | 'answer_question'
  | 'break_objection'
  | 'show_backstage'
  | 'generate_interaction'
  | 'reactivate_audience'
