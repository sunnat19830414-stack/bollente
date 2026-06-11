import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import Login from './pages/Login'
import Layout from './components/Layout'
import QuickSale from './pages/seller/QuickSale'
import ProjectSale from './pages/seller/ProjectSale'
import Orders from './pages/seller/Orders'
import PickingList from './pages/assembler/PickingList'
import Dashboard from './pages/owner/Dashboard'
import Reports from './pages/owner/Reports'
import Users from './pages/owner/Users'

function Guard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { token, role } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (!roles.includes(role!)) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function Home() {
  const { token, role } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (role === 'assembler') return <Navigate to="/assembler" replace />
  if (role === 'owner') return <Navigate to="/owner" replace />
  return <Navigate to="/seller/quick" replace />
}

export default function App() {
  const { token, role } = useAuth()
  const loginRedirect = !token ? '/login' :
    role === 'assembler' ? '/assembler' :
    role === 'owner' ? '/owner' : '/seller/quick'

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to={loginRedirect} replace />} />
      <Route path="/seller/quick"   element={<Guard roles={['seller', 'owner']}><QuickSale /></Guard>} />
      <Route path="/seller/project" element={<Guard roles={['seller', 'owner']}><ProjectSale /></Guard>} />
      <Route path="/seller/orders"  element={<Guard roles={['seller', 'owner']}><Orders /></Guard>} />
      <Route path="/assembler"      element={<Guard roles={['assembler', 'owner']}><PickingList /></Guard>} />
      <Route path="/owner"          element={<Guard roles={['owner']}><Dashboard /></Guard>} />
      <Route path="/owner/reports"  element={<Guard roles={['owner']}><Reports /></Guard>} />
      <Route path="/owner/users"    element={<Guard roles={['owner']}><Users /></Guard>} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
