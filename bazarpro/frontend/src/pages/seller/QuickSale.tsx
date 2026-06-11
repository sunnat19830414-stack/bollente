import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { useAuth } from '../../store/auth'
import { useLang } from '../../i18n'

type Product  = { id: number; ref: string; label: string; price: number; cost_price: number; stock: number; unit: string; category_id: number }
type Category = { id: number; label: string }
type Line     = { product_id: number; ref: string; label: string; qty: number; unit: string; price: number; cost_price: number; discount_pct: number }

const fmt    = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const net    = (l: Line) => l.qty * l.price * (1 - l.discount_pct / 100)
const getUid = (token: string | null) => {
  try { return parseInt(JSON.parse(atob(token!.split('.')[1])).sub) } catch { return 0 }
}

export default function QuickSale() {
  const { t } = useLang()
  const { token, store_id } = useAuth()
  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search,     setSearch]     = useState('')
  const [catId,      setCatId]      = useState(0)
  const [cart,       setCart]       = useState<Line[]>([])
  const [custName,   setCustName]   = useState('')
  const [custPhone,  setCustPhone]  = useState('')
  const [cash,       setCash]       = useState('')
  const [cardPay,    setCardPay]    = useState('')
  const [xfer,       setXfer]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [warnLines,  setWarnLines]  = useState<string[]>([])
  const [success,    setSuccess]    = useState<any>(null)
  const [tab,        setTab]        = useState<'p' | 'c'>('p')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    api.get('/products/categories').then(r => setCategories(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api.get('/products', { params: { search, category_id: catId } })
        .then(r => setProducts(r.data)).catch(() => {})
    }, 300)
    return () => clearTimeout(timer.current)
  }, [search, catId])

  const add = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(l => l.product_id === p.id)
      if (ex) return prev.map(l => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { product_id: p.id, ref: p.ref, label: p.label, qty: 1, unit: p.unit, price: p.price, cost_price: p.cost_price, discount_pct: 0 }]
    })
    setTab('c')
  }

  const upd = (i: number, f: keyof Line, v: any) =>
    setCart(prev => prev.map((l, idx) => idx === i ? { ...l, [f]: v } : l))

  const total   = cart.reduce((s, l) => s + net(l), 0)
  const paidAmt = (parseFloat(cash) || 0) + (parseFloat(cardPay) || 0) + (parseFloat(xfer) || 0)
  const change  = paidAmt - total

  const preCheck = () => {
    const warns: string[] = []
    cart.forEach(l => {
      const eff = l.price * (1 - l.discount_pct / 100)
      if (l.cost_price > 0 && eff < l.cost_price)
        warns.push(`${l.label}: ${fmt(eff)} < ${fmt(l.cost_price)} (себест.)`)
    })
    return warns
  }

  const submit = async (confirmed = false) => {
    if (!cart.length || paidAmt < total) return
    if (!confirmed) {
      const w = preCheck()
      if (w.length) { setWarnLines(w); return }
    }
    setWarnLines([])
    setSubmitting(true)
    try {
      const { data } = await api.post('/orders/quick', {
        items: cart,
        payment_cash: parseFloat(cash) || 0,
        payment_card: parseFloat(cardPay) || 0,
        payment_transfer: parseFloat(xfer) || 0,
        customer_name: custName || null,
        customer_phone: custPhone || null,
        seller_id: getUid(token),
        store_id: store_id || 1,
      })
      setSuccess(data.order)
      setCart([]); setCash(''); setCardPay(''); setXfer('')
      setCustName(''); setCustPhone(''); setTab('p')
    } catch {
      alert('Ошибка сервера')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return <Receipt order={success} onClose={() => setSuccess(null)} />

  const ProductPanel = (
    <div className="flex flex-col h-full gap-2">
      <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
        placeholder={t.search}
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button onClick={() => setCatId(0)}
          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${catId === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
          {t.all}
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setCatId(c.id)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${catId === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto flex-1 space-y-1">
        {products.length === 0 && <p className="text-gray-400 text-sm text-center py-8">{t.noProducts}</p>}
        {products.map(p => (
          <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm hover:shadow">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.label}</p>
              <p className="text-xs text-gray-400">{p.ref} · {p.stock} {p.unit}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-blue-700">{fmt(p.price)}</p>
              <p className="text-xs text-gray-400">сум</p>
            </div>
            <button onClick={() => add(p)}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 active:scale-95 transition shrink-0">
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  const CartPanel = (
    <div className="flex flex-col h-full gap-3">
      <div className="overflow-y-auto flex-1 space-y-2">
        {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Корзина пуста</p>}
        {cart.map((l, i) => (
          <div key={i} className="bg-white rounded-lg p-3 shadow-sm space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium flex-1 pr-2">{l.label}</p>
              <button onClick={() => setCart(prev => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
            <div className="flex gap-2 items-center text-xs">
              <span className="text-gray-500">{t.qty}:</span>
              <input type="number" min="0.01" step="0.01" value={l.qty}
                onChange={e => upd(i, 'qty', parseFloat(e.target.value) || 0)}
                className="w-16 border rounded px-2 py-1 text-center" />
              <span className="text-gray-400">{l.unit}</span>
              <span className="text-gray-500 ml-2">{t.price}:</span>
              <input type="number" min="0" value={l.price}
                onChange={e => upd(i, 'price', parseFloat(e.target.value) || 0)}
                className="w-24 border rounded px-2 py-1 text-center" />
              <span className="text-gray-500 ml-2">{t.discount}:</span>
              <input type="number" min="0" max="100" value={l.discount_pct}
                onChange={e => upd(i, 'discount_pct', parseFloat(e.target.value) || 0)}
                className="w-14 border rounded px-2 py-1 text-center" />
            </div>
            <p className="text-right text-sm font-bold text-blue-700">{fmt(net(l))} сум</p>
          </div>
        ))}
      </div>

      {/* Customer (optional) */}
      <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Клиент (необязательно)</p>
        <div className="flex gap-2">
          <input value={custName} onChange={e => setCustName(e.target.value)}
            placeholder={t.customerName}
            className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <input value={custPhone} onChange={e => setCustPhone(e.target.value)}
            placeholder={t.customerPhone}
            className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Оплата</p>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: t.cash, val: cash, set: setCash }, { label: t.card, val: cardPay, set: setCardPay }, { label: t.transfer, val: xfer, set: setXfer }].map(({ label, val, set }) => (
            <div key={label}>
              <label className="text-xs text-gray-500">{label}</label>
              <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          ))}
        </div>
        <div className="pt-1 space-y-0.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t.total}:</span>
            <span className="font-bold">{fmt(total)} сум</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Оплачено:</span>
            <span className={`font-bold ${paidAmt >= total ? 'text-green-600' : 'text-red-500'}`}>{fmt(paidAmt)} сум</span>
          </div>
          {change > 0 && <div className="flex justify-between text-green-700">
            <span>Сдача:</span><span className="font-bold">{fmt(change)} сум</span>
          </div>}
        </div>
      </div>

      {/* Warnings modal */}
      {warnLines.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
          <p className="font-medium text-yellow-800 mb-1">⚠️ {t.belowCost}</p>
          {warnLines.map((w, i) => <p key={i} className="text-yellow-700 text-xs">{w}</p>)}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setWarnLines([])} className="flex-1 border rounded py-1.5 text-xs">{t.cancel}</button>
            <button onClick={() => submit(true)} className="flex-1 bg-yellow-500 text-white rounded py-1.5 text-xs font-medium">Продать всё равно</button>
          </div>
        </div>
      )}

      <button onClick={() => submit()} disabled={submitting || !cart.length || paidAmt < total}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm">
        {submitting ? t.loading : `✓ Оформить продажу · ${fmt(total)} сум`}
      </button>
    </div>
  )

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Mobile tabs */}
      <div className="md:hidden flex mb-3 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab('p')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition ${tab === 'p' ? 'bg-white shadow' : 'text-gray-500'}`}>
          Товары
        </button>
        <button onClick={() => setTab('c')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition ${tab === 'c' ? 'bg-white shadow' : 'text-gray-500'}`}>
          {t.cart} {cart.length > 0 && `(${cart.length})`}
        </button>
      </div>

      {/* Desktop split / Mobile single */}
      <div className="flex-1 overflow-hidden md:grid md:grid-cols-2 md:gap-4">
        <div className={`h-full overflow-hidden ${tab === 'p' ? 'block' : 'hidden'} md:block`}>{ProductPanel}</div>
        <div className={`h-full overflow-hidden ${tab === 'c' ? 'block' : 'hidden'} md:block`}>{CartPanel}</div>
      </div>
    </div>
  )
}

function Receipt({ order, onClose }: { order: any; onClose: () => void }) {
  const print = () => window.print()
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
  return (
    <div className="max-w-sm mx-auto">
      <div id="receipt" className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div className="text-center border-b pb-3">
          <p className="text-xl font-bold">🛒 BazarPro</p>
          <p className="text-xs text-gray-500 mt-1">Чек #{order.ref}</p>
          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
        </div>
        {order.customer_name && order.customer_name !== 'Розничный покупатель' && (
          <p className="text-sm">Клиент: <b>{order.customer_name}</b> {order.customer_phone}</p>
        )}
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-gray-500">
            <th className="text-left py-1">Товар</th>
            <th className="text-right py-1">Кол</th>
            <th className="text-right py-1">Сумма</th>
          </tr></thead>
          <tbody>
            {order.items.map((it: any, i: number) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 pr-2">{it.label}</td>
                <td className="text-right py-1 whitespace-nowrap">{it.qty} {it.unit}</td>
                <td className="text-right py-1 whitespace-nowrap font-medium">{fmt(it.qty * it.price * (1 - it.discount_pct / 100))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span>Итого</span><span>{fmt(order.total)} сум</span>
          </div>
          {order.payment_cash    > 0 && <div className="flex justify-between text-gray-600"><span>Нал.</span><span>{fmt(order.payment_cash)}</span></div>}
          {order.payment_card    > 0 && <div className="flex justify-between text-gray-600"><span>Карта</span><span>{fmt(order.payment_card)}</span></div>}
          {order.payment_transfer > 0 && <div className="flex justify-between text-gray-600"><span>Перевод</span><span>{fmt(order.payment_transfer)}</span></div>}
        </div>
        <p className="text-center text-xs text-gray-400">Спасибо за покупку!</p>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={print} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm">🖨 Печать</button>
        <button onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm">Новая продажа</button>
      </div>
    </div>
  )
}
