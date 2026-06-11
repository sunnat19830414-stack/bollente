import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { useAuth } from '../../store/auth'
import { useLang } from '../../i18n'

type Product  = { id: number; ref: string; label: string; price: number; cost_price: number; stock: number; unit: string; category_id: number }
type Category = { id: number; label: string }
type Line     = { product_id: number; ref: string; label: string; qty: number; unit: string; price: number; cost_price: number; discount_pct: number }

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const net = (l: Line) => l.qty * l.price * (1 - l.discount_pct / 100)
const getUid = (token: string | null) => {
  try { return parseInt(JSON.parse(atob(token!.split('.')[1])).sub) } catch { return 0 }
}

export default function ProjectSale() {
  const { t } = useLang()
  const { token, store_id } = useAuth()
  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search,     setSearch]     = useState('')
  const [catId,      setCatId]      = useState(0)
  const [cart,       setCart]       = useState<Line[]>([])
  const [custName,   setCustName]   = useState('')
  const [custPhone,  setCustPhone]  = useState('')
  const [objName,    setObjName]    = useState('')
  const [masterName, setMasterName] = useState('')
  const [advance,    setAdvance]    = useState('')
  const [note,       setNote]       = useState('')
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

  const total = cart.reduce((s, l) => s + net(l), 0)
  const remaining = total - (parseFloat(advance) || 0)

  const preCheck = () => {
    const warns: string[] = []
    cart.forEach(l => {
      const eff = l.price * (1 - l.discount_pct / 100)
      if (l.cost_price > 0 && eff < l.cost_price)
        warns.push(`${l.label}: ${fmt(eff)} < ${fmt(l.cost_price)}`)
    })
    return warns
  }

  const submit = async (confirmed = false) => {
    if (!cart.length || !custName || !custPhone || !objName || !masterName) {
      alert('Заполните все обязательные поля')
      return
    }
    if (!confirmed) {
      const w = preCheck()
      if (w.length) { setWarnLines(w); return }
    }
    setWarnLines([])
    setSubmitting(true)
    try {
      const { data } = await api.post('/orders/project', {
        items: cart,
        customer_name: custName,
        customer_phone: custPhone,
        object_name: objName,
        master_name: masterName,
        advance_amount: parseFloat(advance) || 0,
        note,
        seller_id: getUid(token),
        store_id: store_id || 1,
      })
      setSuccess(data.order)
    } catch {
      alert('Ошибка сервера')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return (
    <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-6 text-center space-y-4">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-bold">Проект создан!</h2>
      <p className="text-gray-600">Заказ <b>{success.ref}</b> передан в сборку</p>
      <div className="text-left bg-gray-50 rounded-lg p-4 text-sm space-y-1">
        <p><b>Клиент:</b> {success.customer_name} {success.customer_phone}</p>
        <p><b>Объект:</b> {success.object_name}</p>
        <p><b>Мастер:</b> {success.master_name}</p>
        <p><b>Итого:</b> {fmt(success.total)} сум</p>
        <p><b>Аванс:</b> {fmt(success.advance || 0)} сум</p>
        <p><b>Остаток:</b> {fmt((success.total || 0) - (success.advance || 0))} сум</p>
      </div>
      <button onClick={() => {
        setSuccess(null); setCart([]); setCustName(''); setCustPhone('')
        setObjName(''); setMasterName(''); setAdvance(''); setNote('')
      }} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium">
        Новый проект
      </button>
    </div>
  )

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
        {products.map(p => (
          <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.label}</p>
              <p className="text-xs text-gray-400">{p.ref} · {p.stock} {p.unit}</p>
            </div>
            <p className="text-sm font-bold text-blue-700 shrink-0">{fmt(p.price)} сум</p>
            <button onClick={() => add(p)}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition shrink-0">+</button>
          </div>
        ))}
      </div>
    </div>
  )

  const CartPanel = (
    <div className="flex flex-col h-full gap-3 overflow-y-auto">
      {/* Client info */}
      <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Данные проекта <span className="text-red-500">*</span></p>
        <div className="grid grid-cols-2 gap-2">
          <input value={custName} onChange={e => setCustName(e.target.value)} placeholder={`${t.customerName} *`}
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder={`${t.customerPhone} *`}
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <input value={objName} onChange={e => setObjName(e.target.value)} placeholder={`${t.objectName} *`}
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <input value={masterName} onChange={e => setMasterName(e.target.value)} placeholder={`${t.masterName} *`}
            className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Примечание"
          rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </div>

      {/* Cart items */}
      <div className="space-y-2">
        {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Корзина пуста</p>}
        {cart.map((l, i) => (
          <div key={i} className="bg-white rounded-lg p-3 shadow-sm space-y-2">
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium flex-1 pr-2">{l.label}</p>
              <button onClick={() => setCart(prev => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
            <div className="flex gap-2 items-center text-xs flex-wrap">
              <span className="text-gray-500">{t.qty}:</span>
              <input type="number" min="0.01" step="0.01" value={l.qty}
                onChange={e => upd(i, 'qty', parseFloat(e.target.value) || 0)}
                className="w-16 border rounded px-2 py-1 text-center" />
              <span className="text-gray-500">{t.price}:</span>
              <input type="number" min="0" value={l.price}
                onChange={e => upd(i, 'price', parseFloat(e.target.value) || 0)}
                className="w-24 border rounded px-2 py-1 text-center" />
              <span className="text-gray-500">{t.discount}%:</span>
              <input type="number" min="0" max="100" value={l.discount_pct}
                onChange={e => upd(i, 'discount_pct', parseFloat(e.target.value) || 0)}
                className="w-14 border rounded px-2 py-1 text-center" />
            </div>
            <p className="text-right text-sm font-bold text-blue-700">{fmt(net(l))} сум</p>
          </div>
        ))}
      </div>

      {/* Advance */}
      <div className="bg-white rounded-lg p-3 shadow-sm space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase">Финансы</p>
        <div className="flex gap-2 items-center text-sm">
          <span className="text-gray-600 w-20">{t.advance}:</span>
          <input type="number" min="0" value={advance} onChange={e => setAdvance(e.target.value)}
            className="flex-1 border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <div className="text-sm space-y-0.5 pt-1">
          <div className="flex justify-between font-bold"><span>{t.total}:</span><span>{fmt(total)} сум</span></div>
          <div className="flex justify-between text-orange-600"><span>{t.remaining}:</span><span>{fmt(remaining)} сум</span></div>
        </div>
      </div>

      {warnLines.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
          <p className="font-medium text-yellow-800 mb-1">⚠️ {t.belowCost}</p>
          {warnLines.map((w, i) => <p key={i} className="text-yellow-700 text-xs">{w}</p>)}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setWarnLines([])} className="flex-1 border rounded py-1.5 text-xs">{t.cancel}</button>
            <button onClick={() => submit(true)} className="flex-1 bg-yellow-500 text-white rounded py-1.5 text-xs font-medium">Продолжить</button>
          </div>
        </div>
      )}

      <button onClick={() => submit()} disabled={submitting || !cart.length}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 text-sm">
        {submitting ? t.loading : `📋 Создать проект · ${fmt(total)} сум`}
      </button>
    </div>
  )

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="md:hidden flex mb-3 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setTab('p')} className={`flex-1 py-1.5 rounded-md text-sm font-medium ${tab === 'p' ? 'bg-white shadow' : 'text-gray-500'}`}>Товары</button>
        <button onClick={() => setTab('c')} className={`flex-1 py-1.5 rounded-md text-sm font-medium ${tab === 'c' ? 'bg-white shadow' : 'text-gray-500'}`}>
          {t.cart} {cart.length > 0 && `(${cart.length})`}
        </button>
      </div>
      <div className="flex-1 overflow-hidden md:grid md:grid-cols-2 md:gap-4">
        <div className={`h-full overflow-hidden ${tab === 'p' ? 'block' : 'hidden'} md:block`}>{ProductPanel}</div>
        <div className={`h-full overflow-y-auto ${tab === 'c' ? 'block' : 'hidden'} md:block`}>{CartPanel}</div>
      </div>
    </div>
  )
}
