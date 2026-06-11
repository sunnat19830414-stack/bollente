import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useLang } from '../../i18n'

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

export default function Dashboard() {
  const { t } = useLang()
  const [summary, setSummary] = useState<any>(null)
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/reports/summary', { params: { day: date } }),
      api.get('/orders'),
    ]).then(([s, o]) => {
      setSummary(s.data)
      setOrders(o.data.slice(0, 10))
    }).finally(() => setLoading(false))
  }, [date])

  const STATUS_COLOR: Record<string, string> = {
    paid: 'bg-green-100 text-green-700', confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">{t.dashboard}</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">{t.loading}</p>
      ) : summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.revenue,      val: fmt(summary.revenue) + ' сум', sub: `${summary.count} заказов`, color: 'text-blue-700' },
              { label: 'Оплачено',     val: fmt(summary.paid) + ' сум',    sub: `Нал: ${fmt(summary.cash)}`, color: 'text-green-700' },
              { label: t.debts,        val: fmt(summary.debt) + ' сум',    sub: `Карта: ${fmt(summary.card)}`, color: summary.debt > 0 ? 'text-orange-600' : 'text-gray-500' },
              { label: 'Перевод',      val: fmt(summary.transfer) + ' сум', sub: `${date}`, color: 'text-purple-700' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.val}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* By seller */}
          {Object.keys(summary.by_seller).length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-medium text-gray-700 mb-3">По продавцам</h3>
              <div className="space-y-2">
                {Object.entries(summary.by_seller).map(([name, s]: [string, any]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm">{name}</span>
                    <div className="text-right">
                      <span className="text-sm font-medium">{fmt(s.total)} сум</span>
                      <span className="text-xs text-gray-400 ml-2">({s.count} заказ.)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium text-gray-700">Последние заказы</h3>
        </div>
        <div className="divide-y">
          {orders.map(o => (
            <div key={o.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <span className="font-medium text-sm">{o.ref}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-600'}`}>
                  {o.status}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{o.customer_name} · {o.seller_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-blue-700">{fmt(o.total)} сум</p>
                <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && !loading && <p className="text-center text-gray-400 py-6 text-sm">Нет заказов</p>}
        </div>
      </div>
    </div>
  )
}
