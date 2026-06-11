import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useLang } from '../../i18n'

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

export default function Reports() {
  const { t } = useLang()
  const [tab,    setTab]    = useState<'summary' | 'top' | 'debts'>('summary')
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [data,   setData]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    const req =
      tab === 'summary' ? api.get('/reports/summary', { params: { day: date } }) :
      tab === 'top'     ? api.get('/reports/top-products') :
                          api.get('/reports/debts')
    req.then(r => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab, date])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <h1 className="font-bold text-xl text-gray-800">Отчёты</h1>
        <div className="flex gap-1 ml-2">
          {(['summary', 'top', 'debts'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-3 py-1.5 rounded-lg text-sm ${tab === tb ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {tb === 'summary' ? 'За день' : tb === 'top' ? 'Топ товары' : t.debts}
            </button>
          ))}
        </div>
        {tab === 'summary' && (
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ml-auto" />
        )}
      </div>

      {loading && <p className="text-center text-gray-400 py-12">{t.loading}</p>}

      {!loading && tab === 'summary' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: t.revenue,  val: fmt(data.revenue), unit: 'сум' },
              { label: 'Оплачено', val: fmt(data.paid),    unit: 'сум' },
              { label: t.debts,    val: fmt(data.debt),    unit: 'сум', warn: data.debt > 0 },
              { label: 'Заказов',  val: data.count,        unit: 'шт' },
              { label: 'Наличные', val: fmt(data.cash),    unit: 'сум' },
              { label: 'Карта',    val: fmt(data.card),    unit: 'сум' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.warn ? 'text-orange-600' : 'text-blue-700'}`}>{c.val}</p>
                <p className="text-xs text-gray-400">{c.unit}</p>
              </div>
            ))}
          </div>
          {Object.keys(data.by_seller || {}).length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-medium mb-3">По продавцам</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-1">Продавец</th>
                  <th className="text-right py-1">Заказов</th>
                  <th className="text-right py-1">Сумма</th>
                </tr></thead>
                <tbody>
                  {Object.entries(data.by_seller).map(([name, s]: [string, any]) => (
                    <tr key={name} className="border-b last:border-0">
                      <td className="py-2">{name}</td>
                      <td className="text-right">{s.count}</td>
                      <td className="text-right font-medium">{fmt(s.total)} сум</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'top' && Array.isArray(data) && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Товар</th>
              <th className="text-right px-4 py-3">Кол-во</th>
              <th className="text-right px-4 py-3">Выручка</th>
            </tr></thead>
            <tbody className="divide-y">
              {data.map((p: any, i: number) => (
                <tr key={p.ref}>
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3"><p className="font-medium">{p.label}</p><p className="text-xs text-gray-400">{p.ref}</p></td>
                  <td className="px-4 py-3 text-right">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{fmt(p.revenue)} сум</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'debts' && Array.isArray(data) && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {data.length === 0 && <p className="text-center py-8 text-gray-400">Долгов нет 🎉</p>}
          {data.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-4 py-3">Клиент</th>
                <th className="text-left px-4 py-3">Заказ</th>
                <th className="text-right px-4 py-3">Итого</th>
                <th className="text-right px-4 py-3">Оплачено</th>
                <th className="text-right px-4 py-3 text-orange-600">Долг</th>
              </tr></thead>
              <tbody className="divide-y">
                {data.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.customer_name}</p>
                      <p className="text-xs text-gray-400">{d.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.order_ref}</td>
                    <td className="px-4 py-3 text-right">{fmt(d.total)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(d.paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(d.debt)} сум</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2 font-medium text-sm">Итого долгов:</td>
                  <td className="px-4 py-2 text-right font-bold text-orange-600">
                    {fmt(data.reduce((s: number, d: any) => s + d.debt, 0))} сум
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
