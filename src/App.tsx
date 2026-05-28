import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'

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

  if (state.authLoading) return <PageLoader />
  if (!state.supabaseUser) return <Navigate to="/login" replace />

  // Redirecionar para onboarding se profile ainda não completou
  const onboardingDone = state.profile?.onboarding_completed ?? false
  if (!onboardingDone) return <Navigate to="/onboarding" replace />

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

  if (state.authLoading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            state.supabaseUser
              ? <Navigate to={(state.profile?.onboarding_completed) ? '/' : '/onboarding'} replace />
              : <Login />
          }
        />
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
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
