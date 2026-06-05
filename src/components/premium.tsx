import type { ReactNode } from 'react'
import { Bell } from 'lucide-react'

export function PremiumCard({
  children,
  className = '',
  active = false,
}: {
  children: ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <div className={`premium-card ${active ? 'premium-card-active' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function IconBadge({
  children,
  tone = 'purple',
  className = '',
}: {
  children: ReactNode
  tone?: 'purple' | 'green' | 'orange' | 'red' | 'neutral'
  className?: string
}) {
  return <div className={`premium-icon premium-icon-${tone} ${className}`}>{children}</div>
}

export function HeaderBlock({
  title,
  subtitle,
  eyebrow,
  actions,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={`premium-header ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="premium-eyebrow">{eyebrow}</p>}
        <h1 className="premium-title">{title}</h1>
        {subtitle && <p className="premium-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="premium-header-actions">{actions}</div>}
    </header>
  )
}

export function HeaderActions({
  initials = 'DB',
  avatarUrl,
  showNotifications = true,
}: {
  initials?: string
  avatarUrl?: string | null
  showNotifications?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {showNotifications && (
        <button className="premium-round-button" type="button" aria-label="Notificações" title="Notificações">
          <Bell size={18} />
        </button>
      )}
      <div className="premium-avatar" aria-label="Perfil">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
      </div>
    </div>
  )
}

export function TopTabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
}: {
  items: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`premium-top-tabs ${className}`}>
      {items.map(item => (
        <button key={item.value} type="button" data-active={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function CTAButton({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`premium-cta ${className}`}>
      {children}
    </button>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="premium-empty">
      <div className="premium-empty-icon">{icon}</div>
      <p>{title}</p>
      <span>{subtitle}</span>
    </div>
  )
}
