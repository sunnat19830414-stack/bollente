import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useLang } from '../i18n'
import api from '../api/client'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth } = useAuth()
  const { lang, setLang, t } = useLang()
  const nav = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { username, password })
      setAuth(data.access_token, data.role, data.name, data.store_id)
      if (data.role === 'assembler') nav('/assembler')
      else if (data.role === 'owner') nav('/owner')
      else nav('/seller/quick')
    } catch {
      setError('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🛒</div>
          <h1 className="text-2xl font-bold text-gray-800">BazarPro</h1>
          <p className="text-gray-500 text-sm mt-1">Система управления торговлей</p>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          {(['ru', 'uz'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition ${lang === l ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              {l === 'ru' ? 'Русский' : "O'zbek"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.username}</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="owner / seller1 / assembler1" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50">
            {loading ? t.loading : t.login}
          </button>
        </form>
      </div>
    </div>
  )
}
