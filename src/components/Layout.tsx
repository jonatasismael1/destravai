import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CalendarDays, Home, NotebookPen, Sparkles, UserCircle } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Hoje', tour: 'nav-home' },
  { to: '/criar', icon: Sparkles, label: 'Criar', tour: 'nav-criar' },
  { to: '/espaco', icon: NotebookPen, label: 'Espaço', tour: 'nav-espaco' },
  { to: '/calendario', icon: CalendarDays, label: 'Agenda', tour: 'nav-agenda' },
  { to: '/voce', icon: UserCircle, label: 'Você', tour: 'nav-ajustes' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex flex-col max-w-md mx-auto relative" style={{ height: '100svh', background: 'var(--bg-base)' }}>
      <main
        className="flex-1 overflow-y-scroll relative z-10"
        style={{
          paddingBottom: 'calc(82px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
        style={{
          background: 'linear-gradient(180deg, var(--nav-gradient-start), var(--nav-bg))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--nav-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        <div className="flex items-stretch justify-around px-3 pt-2.5 pb-2">
          {navItems.map(({ to, icon: Icon, label, tour }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : to === '/voce'
                ? location.pathname.startsWith('/voce') || location.pathname.startsWith('/configuracoes')
                : location.pathname.startsWith(to)
            const color = isActive ? 'var(--brand)' : 'var(--text-muted)'

            return (
              <NavLink
                key={to}
                to={to}
                data-tour={tour}
                className="relative flex flex-col items-center justify-start gap-1 flex-1 pt-2 pb-1 transition-colors duration-200"
              >
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full transition-opacity duration-200"
                  style={{ background: 'linear-gradient(90deg, #8F73FF, #6E48FF)', opacity: isActive ? 1 : 0 }}
                />
                <Icon size={23} strokeWidth={isActive ? 2.25 : 1.8} style={{ color }} />
                <span className="text-[10px] font-semibold transition-colors duration-200" style={{ color }}>
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
