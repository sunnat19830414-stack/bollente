import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useLang } from '../../i18n'

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Ожидает',  cls: 'bg-gray-100 text-gray-600' },
  picked:      { label: 'Собрано',  cls: 'bg-green-100 text-green-700' },
  substituted: { label: 'Замена',   cls: 'bg-orange-100 text-orange-700' },
  unavailable: { label: 'Нет',      cls: 'bg-red-100 text-red-700' },
}

export default function PickingList() {
  const { t } = useLang()
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sel,     setSel]     = useState<any>(null)
  const [subForm, setSubForm] = useState<{ idx: number; ref: string; label: string; price: string } | null>(null)
  const [shipping, setShipping] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/orders', { params: { status: 'confirmed' } })
      .then(r => setOrders(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markItem = async (orderId: number, idx: number, status: string) => {
    const { data } = await api.patch(`/orders/${orderId}/item/${idx}/substitute`, { status })
    setSel(data)
    setOrders(prev => prev.map(o => o.id === orderId ? data : o))
  }

  const substitute = async () => {
    if (!subForm || !sel) return
    const { data } = await api.patch(`/orders/${sel.id}/item/${subForm.idx}/substitute`, {
      substitute_ref:   subForm.ref,
      substitute_label: subForm.label,
      substitute_price: parseFloat(subForm.price) || 0,
    })
    setSel(data)
    setOrders(prev => prev.map(o => o.id === sel.id ? data : o))
    setSubForm(null)
  }

  const ship = async (orderId: number) => {
    setShipping(true)
    try {
      const { data } = await api.patch(`/orders/${orderId}/ship`)
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setSel(null)
    } catch {
      alert('Ошибка')
    } finally {
      setShipping(false)
    }
  }

  const allPicked = (order: any) =>
    order.items.every((it: any) => ['picked', 'substituted', 'unavailable'].includes(it.status))

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Order list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-gray-700">{t.pickingList}</h2>
          <button onClick={load} className="text-sm text-blue-600 hover:underline">↻ Обновить</button>
        </div>
        {loading && <p className="text-center text-gray-400 py-8">{t.loading}</p>}
        {!loading && orders.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">✅</p>
            <p>Все заказы собраны!</p>
          </div>
        )}
        {orders.map(o => {
          const picked = o.items.filter((it: any) => it.status !== 'pending').length
          const total  = o.items.length
          return (
            <div key={o.id} onClick={() => setSel(o)}
              className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer border-2 transition ${sel?.id === o.id ? 'border-blue-400' : 'border-transparent hover:shadow'}`}>
              <div className="flex justify-between mb-1">
                <span className="font-bold">{o.ref}</span>
                <span className="text-sm text-gray-500">{picked}/{total} позиций</span>
              </div>
              <p className="text-sm text-gray-700">{o.customer_name}</p>
              <p className="text-xs text-gray-400">📍 {o.object_name} · 👷 {o.master_name}</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${total ? picked / total * 100 : 0}%` }} />
              </div>
              {allPicked(o) && (
                <p className="text-xs text-green-600 font-medium mt-1">✓ Готово к отправке</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Order detail */}
      {sel && (
        <div className="w-96 bg-white rounded-xl shadow-lg p-4 overflow-y-auto flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">{sel.ref}</h3>
              <p className="text-sm text-gray-500">{sel.customer_name}</p>
              <p className="text-xs text-gray-400">📍 {sel.object_name} · 👷 {sel.master_name}</p>
            </div>
            <button onClick={() => setSel(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="space-y-2">
            {sel.items.map((it: any, i: number) => (
              <div key={i} className={`rounded-lg p-3 border ${it.status === 'picked' ? 'bg-green-50 border-green-200' : it.status === 'unavailable' ? 'bg-red-50 border-red-200' : it.status === 'substituted' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{it.label}</p>
                    <p className="text-xs text-gray-500">{it.ref} · {it.qty} {it.unit} · {fmt(it.price)} сум</p>
                    {it.status === 'substituted' && (
                      <p className="text-xs text-orange-700 mt-0.5">→ {it.substitute_label} ({fmt(it.substitute_price || 0)} сум)</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ITEM_STATUS[it.status]?.cls}`}>
                    {ITEM_STATUS[it.status]?.label}
                  </span>
                </div>
                {it.status === 'pending' && (
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => markItem(sel.id, i, 'picked')}
                      className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-lg">✓ Собрал</button>
                    <button onClick={() => setSubForm({ idx: i, ref: '', label: '', price: '' })}
                      className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded-lg">↔ Замена</button>
                    <button onClick={() => markItem(sel.id, i, 'unavailable')}
                      className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg">✗ Нет</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Substitute form */}
          {subForm !== null && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-orange-800">Укажите замену</p>
              <input value={subForm.ref} onChange={e => setSubForm(f => f && { ...f, ref: e.target.value })}
                placeholder="Артикул замены"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <input value={subForm.label} onChange={e => setSubForm(f => f && { ...f, label: e.target.value })}
                placeholder="Название замены"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <input type="number" value={subForm.price} onChange={e => setSubForm(f => f && { ...f, price: e.target.value })}
                placeholder="Цена замены (сум)"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <div className="flex gap-2">
                <button onClick={() => setSubForm(null)} className="flex-1 border rounded py-1.5 text-sm">{t.cancel}</button>
                <button onClick={substitute} className="flex-1 bg-orange-500 text-white rounded py-1.5 text-sm font-medium">{t.confirm}</button>
              </div>
            </div>
          )}

          {allPicked(sel) && (
            <button onClick={() => ship(sel.id)} disabled={shipping}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 text-sm">
              {shipping ? '...' : '🚚 Передать клиенту'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
