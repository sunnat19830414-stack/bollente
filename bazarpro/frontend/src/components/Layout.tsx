import { useAuth } from '../store/auth'
import { useLang } from '../i18n'
import { useNavigate, NavLink } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { role, name, logout } = useAuth()
  const { lang, setLang, t } = useLang()
  const nav = useNavigate()

  const handleLogout = () => { logout(); nav('/login') }

  const sellerLinks = [
    { to: '/seller/quick',   label: t.quickSale },
    { to: '/seller/project', label: t.projectSale },
    { to: '/seller/orders',  label: t.orders },
  ]
  const assemblerLinks = [
    { to: '/assembler', label: t.pickingList },
  ]
  const ownerLinks = [
    { to: '/owner', label: t.dashboard },
    { to: '/owner/reports', label: 'Отчёты' },
    { to: '/owner/users', label: 'Сотрудники' },
  ]

  const links = role === 'seller' ? sellerLinks : role === 'assembler' ? assemblerLinks : ownerLinks

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">🛒 BazarPro</span>
          <nav className="hidden md:flex gap-1 ml-4">
            {links.map(l => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium ${isActive ? 'bg-blue-800' : 'hover:bg-blue-700'}`
                }>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === 'ru' ? 'uz' : 'ru')}
            className="text-xs bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded font-medium">
            {lang === 'ru' ? 'UZ' : 'RU'}
          </button>
          <span className="text-sm hidden md:block">{name}</span>
          <button onClick={handleLogout}
            className="text-xs bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded">
            {t.logout}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden bg-blue-700 flex overflow-x-auto px-2 gap-1 pb-1">
        {links.map(l => (
          <NavLink key={l.to} to={l.to}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded text-sm font-medium text-white whitespace-nowrap ${isActive ? 'bg-blue-900' : 'hover:bg-blue-600'}`
            }>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
