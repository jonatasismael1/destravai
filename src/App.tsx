import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { OnboardingProvider } from './context/OnboardingContext'
import Layout from './components/Layout'
import InstallPrompt from './components/InstallPrompt'

const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Home = lazy(() => import('./pages/Home'))
const Criar = lazy(() => import('./pages/Criar'))
const Essencia = lazy(() => import('./pages/Essencia'))
const Biblioteca = lazy(() => import('./pages/Biblioteca'))
const Calendario = lazy(() => import('./pages/Calendario'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const MeuEspaco = lazy(() => import('./pages/MeuEspaco'))
const Grupos = lazy(() => import('./pages/Grupos'))
const TermosDeUso = lazy(() => import('./pages/TermosDeUso'))
const PoliticaPrivacidade = lazy(() => import('./pages/PoliticaPrivacidade'))
const Assinatura = lazy(() => import('./pages/Assinatura'))
const Checkout = lazy(() => import('./pages/Checkout'))
const DefinirSenha = lazy(() => import('./pages/DefinirSenha'))
const MinhaAssinatura = lazy(() => import('./pages/MinhaAssinatura'))
const PagamentoSucesso = lazy(() => import('./pages/PagamentoSucesso'))
const PagamentoErro = lazy(() => import('./pages/PagamentoErro'))

// Paywall: enquanto false, o app não bloqueia acesso (rollout seguro, ninguém
// fica travado durante a configuração). Defina VITE_PAYWALL_ENABLED=true no
// Netlify quando o fluxo de pagamento estiver validado, para passar a exigir
// assinatura ativa.
const PAYWALL_ENABLED = import.meta.env.VITE_PAYWALL_ENABLED === 'true'

// E-mail do administrador (dono do produto). Nunca é bloqueado pelo paywall, mesmo
// sem assinatura — evita que o dono se tranque fora ao ligar a cobrança. Espelha o
// ADMIN_EMAIL do backend (netlify/functions/_shared.mjs).
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'assessoriadbe@gmail.com').toLowerCase()

function PageLoader() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100svh', background: '#0D0B14' }}>
      <span
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '2px solid rgba(109,93,246,0.3)', borderTopColor: '#9B8CFF' }}
      />
    </div>
  )
}

function ProtectedRoutes() {
  const { state } = useApp()

  // Aguarda sessão e profile/essência, senão onboarding_completed fica indefinido.
  if (state.authLoading || state.profileLoading) return <PageLoader />
  if (!state.supabaseUser) return <Navigate to="/login" replace />

  const onboardingDone = state.profile?.onboarding_completed ?? false
  if (!onboardingDone) return <Navigate to="/onboarding" replace />

  // Gating de assinatura (só quando o paywall está ativado). O admin nunca é
  // bloqueado, para o dono conseguir usar/testar mesmo sem assinatura.
  const isAdmin = (state.supabaseUser?.email ?? '').toLowerCase() === ADMIN_EMAIL
  if (PAYWALL_ENABLED && !isAdmin) {
    if (state.subscriptionLoading) return <PageLoader />
    if (!state.subscription?.hasAccess) return <Navigate to="/assinatura" replace />
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/criar" element={<Criar />} />
          <Route path="/essencia" element={<Essencia />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/espaco" element={<MeuEspaco />} />
          <Route path="/grupos" element={<Grupos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

function AppRoutes() {
  const { state } = useApp()

  if (state.authLoading || (state.supabaseUser && state.profileLoading)) return <PageLoader />

  // Exige login para rotas autenticadas que vivem fora do app principal
  // (assinatura, pagamento) — mas não exigem assinatura ativa.
  const authed = !!state.supabaseUser
  const requireAuth = (el: JSX.Element) => (authed ? el : <Navigate to="/login" replace />)

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Públicas */}
        <Route
          path="/login"
          element={
            state.supabaseUser
              ? <Navigate to={(state.profile?.onboarding_completed) ? '/' : '/onboarding'} replace />
              : <Login />
          }
        />
        <Route path="/termos" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />

        {/* Checkout público (vem da landing, sem login). Pague primeiro, acesso depois. */}
        <Route path="/checkout" element={<Checkout />} />
        {/* Destino do link de e-mail para criar/redefinir a senha. */}
        <Route path="/definir-senha" element={<DefinirSenha />} />

        <Route
          path="/onboarding"
          element={
            !state.supabaseUser
              ? <Navigate to="/login" replace />
              : (state.profile?.onboarding_completed)
              ? <Navigate to="/" replace />
              : <Onboarding />
          }
        />

        {/* Autenticadas, sem exigir assinatura ativa */}
        <Route path="/assinatura" element={requireAuth(<Assinatura />)} />
        <Route path="/minha-assinatura" element={requireAuth(<MinhaAssinatura />)} />
        {/* Públicas: retorno do checkout (cartão volta do Asaas SEM sessão; a
            página trata o caso anônimo mostrando "confira seu e-mail"). */}
        <Route path="/pagamento/sucesso" element={<PagamentoSucesso />} />
        <Route path="/pagamento/erro" element={<PagamentoErro />} />

        {/* App principal (com gating de assinatura) */}
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
          <ToastProvider>
            <OnboardingProvider>
              <AppRoutes />
              <InstallPrompt />
            </OnboardingProvider>
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
