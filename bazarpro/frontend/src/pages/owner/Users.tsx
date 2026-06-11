import { useState, useEffect } from 'react'
import api from '../../api/client'

const ROLE_COLOR: Record<string, string> = {
  owner:     'bg-purple-100 text-purple-700',
  seller:    'bg-blue-100 text-blue-700',
  assembler: 'bg-yellow-100 text-yellow-700',
}
const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец', seller: 'Продавец', assembler: 'Сборщик',
}

export default function Users() {
  const [users,   setUsers]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pwdForm, setPwdForm] = useState<{ id: number; val: string } | null>(null)
  const [saving,  setSaving]  = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/auth/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggle = async (id: number) => {
    const { data } = await api.post(`/auth/users/${id}/toggle`)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: data.active } : u))
  }

  const changePass = async () => {
    if (!pwdForm || !pwdForm.val.trim()) return
    setSaving(true)
    try {
      await api.post(`/auth/users/${pwdForm.id}/password`, { password: pwdForm.val })
      setPwdForm(null)
      alert('Пароль изменён')
    } catch {
      alert('Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Сотрудники</h1>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Загрузка...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3">Имя / Логин</th>
              <th className="text-left px-4 py-3">Роль</th>
              <th className="text-right px-4 py-3">Действия</th>
            </tr></thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className={!u.active ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-100'}`}>
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setPwdForm({ id: u.id, val: '' })}
                        className="text-xs border rounded px-2 py-1 hover:bg-gray-50">
                        Пароль
                      </button>
                      <button onClick={() => toggle(u.id)}
                        className={`text-xs px-2 py-1 rounded font-medium ${u.active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {u.active ? 'Отключить' : 'Включить'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password modal */}
      {pwdForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg">Сменить пароль</h3>
            <input
              type="password"
              value={pwdForm.val}
              onChange={e => setPwdForm(f => f && { ...f, val: e.target.value })}
              placeholder="Новый пароль"
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setPwdForm(null)}
                className="flex-1 border rounded-lg py-2 text-sm">Отмена</button>
              <button onClick={changePass} disabled={saving || !pwdForm.val.trim()}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? '...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
