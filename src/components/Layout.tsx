import { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Sparkles, CalendarDays, NotebookPen, Trophy, Settings } from 'lucide-react'

// Navbar na ordem que conta a história natural do produto — "o que faço hoje?" →
// criar → planejar → meu espaço (biblioteca/progresso) → comunidade → ajustar.
// Essência vive em atalhos (Home/Criar/Configurações). Biblioteca passou a viver
// DENTRO de Espaço (é "minha" também). Ranking ganhou slot próprio: lista de
// grupos, criar grupo e, dentro de cada um, ranking + chat. Configurações por
// último: acesso global sem disputar prioridade com as ações do dia a dia.
const navItems = [
  { to: '/', icon: Home, label: 'Hoje' },
  { to: '/criar', icon: Sparkles, label: 'Criar' },
  { to: '/espaco', icon: NotebookPen, label: 'Espaço' },
  { to: '/calendario', icon: CalendarDays, label: 'Agenda' },
  { to: '/grupos', icon: Trophy, label: 'Ranking' },
  { to: '/configuracoes', icon: Settings, label: 'Ajustes' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex flex-col max-w-md mx-auto relative" style={{ height: '100svh', background: 'var(--bg-base)' }}>
      <main
        className="flex-1 overflow-y-scroll relative z-10"
        style={{
          paddingBottom: 'calc(76px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </main>

      {/* Bottom navigation — tab bar nativa: ícone + label, ativo só pelo
          acento de marca e um indicador pequeno (sem bolha/glow roxo). */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--nav-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        <div className="flex items-stretch justify-around px-1 pt-2 pb-1.5">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)

            const color = isActive ? 'var(--brand)' : 'var(--text-muted)'

            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex flex-col items-center justify-start gap-1 flex-1 pt-1.5 pb-1 transition-colors duration-200"
              >
                {/* Indicador superior do item ativo */}
                <span
                  className="absolute top-0 h-0.5 w-6 rounded-full transition-opacity duration-200"
                  style={{ background: 'var(--brand)', opacity: isActive ? 1 : 0 }}
                />
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} style={{ color }} />
                <span
                  className="text-[10px] font-semibold transition-colors duration-200"
                  style={{ color }}
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
