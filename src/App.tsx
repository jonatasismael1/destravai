import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import InstallPrompt from './components/InstallPrompt'

const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Home = lazy(() => import('./pages/Home'))
const Criar = lazy(() => import('./pages/Criar'))
const Essencia = lazy(() => import('./pages/Essencia'))
const Biblioteca = lazy(() => import('./pages/Biblioteca'))
const Progresso = lazy(() => import('./pages/Progresso'))
const Calendario = lazy(() => import('./pages/Calendario'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const MeuEspaco = lazy(() => import('./pages/MeuEspaco'))
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

  // Gating de assinatura (só quando o paywall está ativado)
  if (PAYWALL_ENABLED) {
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
          <Route path="/progresso" element={<Progresso />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/espaco" element={<MeuEspaco />} />
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
        <Route path="/pagamento/sucesso" element={requireAuth(<PagamentoSucesso />)} />
        <Route path="/pagamento/erro" element={requireAuth(<PagamentoErro />)} />

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
            <AppRoutes />
            <InstallPrompt />
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
