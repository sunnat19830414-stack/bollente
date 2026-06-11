import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useLang } from '../../i18n'

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

const STATUS_COLOR: Record<string, string> = {
  paid:      'bg-green-100 text-green-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped:   'bg-purple-100 text-purple-700',
  picking:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Orders() {
  const { t } = useLang()
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('')
  const [sel,     setSel]     = useState<any>(null)
  const [paying,  setPaying]  = useState(false)
  const [payCash, setPayCash] = useState('')
  const [payCard, setPayCard] = useState('')
  const [payXfer, setPayXfer] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/orders', { params: filter ? { status: filter } : {} })
      .then(r => setOrders(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const statusLabel: Record<string, string> = {
    paid: 'Оплачено', confirmed: 'Подтверждён', shipped: 'Отправлено',
    picking: 'Сборка', cancelled: 'Отменён', invoiced: 'Выставлен счёт',
  }

  const pay = async () => {
    if (!sel) return
    setPaying(true)
    try {
      const { data } = await api.patch(`/orders/${sel.id}/pay`, {
        cash: parseFloat(payCash) || 0,
        card: parseFloat(payCard) || 0,
        transfer: parseFloat(payXfer) || 0,
      })
      setSel(data)
      setOrders(prev => prev.map(o => o.id === data.id ? data : o))
      setPayCash(''); setPayCard(''); setPayXfer('')
    } catch {
      alert('Ошибка')
    } finally {
      setPaying(false)
    }
  }

  const filters = [
    { val: '',          label: 'Все' },
    { val: 'confirmed', label: 'Проекты' },
    { val: 'paid',      label: 'Оплачено' },
    { val: 'shipped',   label: 'Отправлено' },
  ]

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Order list */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {filters.map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${filter === f.val ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {loading && <p className="text-center text-gray-400 py-8">{t.loading}</p>}
          {!loading && orders.length === 0 && <p className="text-center text-gray-400 py-8">Нет заказов</p>}
          {orders.map(o => (
            <div key={o.id} onClick={() => setSel(o)}
              className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow transition border-2 ${sel?.id === o.id ? 'border-blue-400' : 'border-transparent'}`}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <span className="font-bold text-sm">{o.ref}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] || 'bg-gray-100'}`}>
                    {statusLabel[o.status] || o.status}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">{o.type === 'quick' ? '⚡ Быстрая' : '📋 Проект'}</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{fmt(o.total)} сум</span>
              </div>
              <p className="text-sm text-gray-600">{o.customer_name}</p>
              {o.object_name && <p className="text-xs text-gray-400">📍 {o.object_name} · {o.master_name}</p>}
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>{o.seller_name}</span>
                <span>{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {o.total > o.paid && <p className="text-xs text-orange-600 mt-1">Долг: {fmt(o.total - o.paid)} сум</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {sel && (
        <div className="w-80 bg-white rounded-xl shadow-lg p-4 overflow-y-auto flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{sel.ref}</h3>
            <button onClick={() => setSel(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="text-sm space-y-1 text-gray-600">
            <p><b>Клиент:</b> {sel.customer_name} {sel.customer_phone && `· ${sel.customer_phone}`}</p>
            {sel.object_name && <p><b>Объект:</b> {sel.object_name}</p>}
            {sel.master_name && <p><b>Мастер:</b> {sel.master_name}</p>}
            <p><b>Продавец:</b> {sel.seller_name}</p>
            <p><b>Дата:</b> {new Date(sel.created_at).toLocaleString('ru-RU')}</p>
          </div>

          <div className="border-t pt-2">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Товары</p>
            {sel.items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                <div>
                  <p>{it.label}</p>
                  {it.status === 'substituted' && (
                    <p className="text-xs text-orange-600">→ {it.substitute_label}</p>
                  )}
                  <p className="text-xs text-gray-400">{it.qty} {it.unit} × {fmt(it.price)} {it.discount_pct > 0 && `(-${it.discount_pct}%)`}</p>
                </div>
                <p className="font-medium shrink-0 ml-2">{fmt(it.qty * it.price * (1 - it.discount_pct / 100))}</p>
              </div>
            ))}
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between font-bold"><span>Итого:</span><span>{fmt(sel.total)} сум</span></div>
            <div className="flex justify-between text-green-600"><span>Оплачено:</span><span>{fmt(sel.paid)} сум</span></div>
            {sel.total > sel.paid && (
              <div className="flex justify-between text-orange-600 font-medium"><span>Долг:</span><span>{fmt(sel.total - sel.paid)} сум</span></div>
            )}
          </div>

          {/* Pay form for project orders */}
          {sel.type === 'project' && sel.total > sel.paid && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Принять оплату</p>
              {[{ l: 'Наличные', v: payCash, s: setPayCash }, { l: 'Карта', v: payCard, s: setPayCard }, { l: 'Перевод', v: payXfer, s: setPayXfer }].map(({ l, v, s }) => (
                <div key={l} className="flex gap-2 items-center text-sm">
                  <span className="w-20 text-gray-600 text-xs">{l}:</span>
                  <input type="number" min="0" value={v} onChange={e => s(e.target.value)}
                    className="flex-1 border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm" />
                </div>
              ))}
              <button onClick={pay} disabled={paying}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {paying ? '...' : 'Принять оплату'}
              </button>
            </div>
          )}

          {/* Action log */}
          {sel.log?.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">История</p>
              {sel.log.map((lg: any, i: number) => (
                <p key={i} className="text-xs text-gray-400">{lg.user}: {lg.action} · {new Date(lg.at).toLocaleTimeString('ru-RU')}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
