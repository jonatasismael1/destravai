import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Sparkles, BookOpen, CalendarDays, NotebookPen, Settings } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

// Navbar na ordem que conta a história natural do produto — "o que faço hoje?" →
// criar → guardar/reusar → planejar → acompanhar evolução → ajustar. Essência saiu
// daqui (não é ação diária; vive em atalhos na Home/Criar/Configurações) e Ranking
// vive dentro de Espaço (caminho único). Configurações fica por último: acesso de
// qualquer tela, sem disputar prioridade com as ações do dia a dia.
const navItems = [
  { to: '/', icon: Home, label: 'Hoje' },
  { to: '/criar', icon: Sparkles, label: 'Criar' },
  { to: '/biblioteca', icon: BookOpen, label: 'Biblioteca' },
  { to: '/calendario', icon: CalendarDays, label: 'Agenda' },
  { to: '/espaco', icon: NotebookPen, label: 'Espaço' },
  { to: '/configuracoes', icon: Settings, label: 'Ajustes' },
]

function DarkOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div
        className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full animate-orb-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(109,93,246,0.28) 0%, rgba(109,93,246,0.08) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,122,107,0.2) 0%, rgba(255,122,107,0.06) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(83,214,161,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />
    </div>
  )
}

function LightOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div
        className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(109,93,246,0.1) 0%, rgba(109,93,246,0.03) 50%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,122,107,0.08) 0%, rgba(255,122,107,0.02) 50%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute top-1/3 right-0 w-[240px] h-[240px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(83,214,161,0.07) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isDark } = useTheme()

  return (
    <div className="flex flex-col max-w-md mx-auto relative" style={{ height: '100svh' }}>
      {isDark ? <DarkOrbs /> : <LightOrbs />}

      <main
        className="flex-1 overflow-y-scroll relative z-10"
        style={{
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderTop: '1px solid var(--nav-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        <div className="flex items-center justify-around px-0.5 py-2.5">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)

            const activeColor  = isDark ? '#9B8CFF' : '#6D5DF6'
            const inactiveColor = isDark
              ? 'rgba(240,238,248,0.45)'
              : 'rgba(109,93,246,0.55)'

            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-2xl transition-all duration-300"
              >
                <div
                  className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300"
                  style={isActive ? {
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(109,93,246,0.3), rgba(155,140,255,0.2))'
                      : 'rgba(109,93,246,0.1)',
                    boxShadow: isDark
                      ? '0 0 16px rgba(109,93,246,0.3)'
                      : '0 0 10px rgba(109,93,246,0.15)',
                    border: isDark
                      ? '1px solid rgba(109,93,246,0.4)'
                      : '1px solid rgba(109,93,246,0.25)',
                  } : {}}
                >
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    style={{ color: isActive ? activeColor : inactiveColor }}
                  />
                  {isActive && (
                    <span
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #6D5DF6, #9B8CFF)' }}
                    />
                  )}
                </div>
                <span
                  className="text-[8px] font-bold tracking-wider uppercase transition-all duration-300"
                  style={{ color: isActive ? activeColor : inactiveColor }}
                >
                  {label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
