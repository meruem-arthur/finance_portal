// Data layer for the finance portal.
//
// Two modes:
//  - LIVE mode: Firebase project credentials are set in .env -> reads/writes
//    real Firestore collections "financePeriods" and its "transactions" subcollection.
//  - DEMO mode: no credentials set -> uses in-memory + localStorage sample data,
//    so the app is fully explorable before Firebase is wired up.

import { db } from './firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs,
} from 'firebase/firestore'

export const DEMO_MODE = !import.meta.env.VITE_FIREBASE_PROJECT_ID

const DEMO_KEY = 'gesa-finance-demo-data'

function seedDemoData() {
  return [
    {
      id: 'p1',
      name: 'Freshers Orientation Week',
      status: 'closed',
      startDate: '2026-02-10',
      endDate: '2026-02-14',
      transactions: [
        { id: 't1', type: 'income', description: 'Registration levy (Level 100)', amount: 4200, date: '2026-02-10' },
        { id: 't2', type: 'expenditure', description: 'Venue & PA system rental', amount: 1100, date: '2026-02-11' },
        { id: 't3', type: 'expenditure', description: 'Printing & banners', amount: 380, date: '2026-02-12' },
        { id: 't4', type: 'expenditure', description: 'Refreshments', amount: 620, date: '2026-02-13' },
      ],
    },
    {
      id: 'p2',
      name: 'Geomatic Innovative Fair',
      status: 'closed',
      startDate: '2026-04-02',
      endDate: '2026-04-04',
      transactions: [
        { id: 't5', type: 'income', description: 'Sponsorship — survey equipment vendor', amount: 3000, date: '2026-04-01' },
        { id: 't6', type: 'income', description: 'Stall & registration fees', amount: 1500, date: '2026-04-02' },
        { id: 't7', type: 'expenditure', description: 'Prizes for winning projects', amount: 1200, date: '2026-04-04' },
        { id: 't8', type: 'expenditure', description: 'Branding & printing', amount: 450, date: '2026-04-02' },
      ],
    },
    {
      id: 'p3',
      name: 'Q2 Departmental Dues',
      status: 'open',
      startDate: '2026-05-01',
      endDate: '2026-07-31',
      transactions: [
        { id: 't9', type: 'income', description: 'Member dues collected', amount: 2800, date: '2026-05-15' },
        { id: 't10', type: 'expenditure', description: 'Executive stationery', amount: 150, date: '2026-06-01' },
      ],
    },
  ]
}

function loadDemo() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  const seeded = seedDemoData()
  localStorage.setItem(DEMO_KEY, JSON.stringify(seeded))
  return seeded
}

function saveDemo(data) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(data))
}

const demoListeners = new Set()
function notifyDemoListeners() {
  const data = loadDemo()
  demoListeners.forEach((cb) => cb(data))
}

// ---- Public API ----

export function subscribePeriods(callback) {
  if (DEMO_MODE) {
    demoListeners.add(callback)
    callback(loadDemo())
    return () => demoListeners.delete(callback)
  }
  const q = query(collection(db, 'financePeriods'), orderBy('startDate', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data(), transactions: [] })))
  })
}

export function subscribeTransactions(periodId, callback) {
  if (DEMO_MODE) {
    const wrap = (data) => {
      const period = data.find((p) => p.id === periodId)
      callback(period ? period.transactions : [])
    }
    demoListeners.add(wrap)
    wrap(loadDemo())
    return () => demoListeners.delete(wrap)
  }
  const q = query(
    collection(db, 'financePeriods', periodId, 'transactions'),
    orderBy('date', 'desc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function addPeriod(period) {
  if (DEMO_MODE) {
    const data = loadDemo()
    data.unshift({ ...period, id: 'p' + Date.now(), transactions: [] })
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await addDoc(collection(db, 'financePeriods'), { ...period, createdAt: serverTimestamp() })
}

export async function updatePeriod(periodId, updates) {
  if (DEMO_MODE) {
    const data = loadDemo()
    const p = data.find((x) => x.id === periodId)
    if (p) Object.assign(p, updates)
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await updateDoc(doc(db, 'financePeriods', periodId), updates)
}

export async function deletePeriod(periodId) {
  if (DEMO_MODE) {
    let data = loadDemo()
    data = data.filter((x) => x.id !== periodId)
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await deleteDoc(doc(db, 'financePeriods', periodId))
}

export async function addTransaction(periodId, txn) {
  if (DEMO_MODE) {
    const data = loadDemo()
    const p = data.find((x) => x.id === periodId)
    if (p) p.transactions.unshift({ ...txn, id: 't' + Date.now() })
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await addDoc(collection(db, 'financePeriods', periodId, 'transactions'), {
    ...txn,
    createdAt: serverTimestamp(),
  })
}

export async function updateTransaction(periodId, txnId, updates) {
  if (DEMO_MODE) {
    const data = loadDemo()
    const p = data.find((x) => x.id === periodId)
    const t = p?.transactions.find((x) => x.id === txnId)
    if (t) Object.assign(t, updates)
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await updateDoc(doc(db, 'financePeriods', periodId, 'transactions', txnId), updates)
}

export async function deleteTransaction(periodId, txnId) {
  if (DEMO_MODE) {
    const data = loadDemo()
    const p = data.find((x) => x.id === periodId)
    if (p) p.transactions = p.transactions.filter((x) => x.id !== txnId)
    saveDemo(data)
    notifyDemoListeners()
    return
  }
  await deleteDoc(doc(db, 'financePeriods', periodId, 'transactions', txnId))
}

export function computeSummary(transactions) {
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const expenditure = transactions.filter((t) => t.type === 'expenditure').reduce((s, t) => s + Number(t.amount || 0), 0)
  return { income, expenditure, balance: income - expenditure }
}

export function formatGHS(amount) {
  return 'GH₵ ' + Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// One-off fetch (not a live subscription) of every period along with its
// transactions — used by the admin-only full audit report export, since that
// needs everything at once rather than whatever's currently selected.
export async function fetchAllPeriodsWithTransactions() {
  if (DEMO_MODE) {
    return loadDemo().map((p) => ({ period: p, transactions: p.transactions }))
  }
  const periodsSnap = await getDocs(query(collection(db, 'financePeriods'), orderBy('startDate', 'asc')))
  const results = []
  for (const periodDoc of periodsSnap.docs) {
    const period = { id: periodDoc.id, ...periodDoc.data() }
    const txnSnap = await getDocs(
      query(collection(db, 'financePeriods', period.id, 'transactions'), orderBy('date', 'asc'))
    )
    const transactions = txnSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    results.push({ period, transactions })
  }
  return results
}
