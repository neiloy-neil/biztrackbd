'use client'

import { useState, useEffect } from 'react'
import { Pencil, Trash2, Plus, Check, X, Phone, Hash, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getAccountsWithBalance, createAccount, updateAccount, deleteAccount } from '../actions'

type Account = {
  id: string
  name: string
  type: string
  subtype: string | null
  current_balance: number
  account_number: string | null
  account_phone: string | null
  bank_name: string | null
}

// ── Display mappings ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  cash: 'নগদ',
  bank: 'ব্যাংক',
  mobile_money: 'মোবাইল ব্যাংকিং',
}

const TYPE_COLORS: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  bank: 'bg-blue-100 text-blue-700',
  mobile_money: 'bg-pink-100 text-pink-700',
}

const SUBTYPE_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  upay: 'Upay',
  bank: 'Bank',
  cash: 'Cash',
  other: 'Other',
}

const SUBTYPE_COLORS: Record<string, string> = {
  bkash:  'bg-pink-100    text-pink-700',
  nagad:  'bg-orange-100  text-orange-700',
  rocket: 'bg-rose-100    text-rose-700',
  upay:   'bg-indigo-100  text-indigo-700',
  other:  'bg-slate-100   text-slate-600',
}

const MOBILE_SUBTYPES = ['bkash', 'nagad', 'rocket', 'upay', 'other']

const ACCOUNT_TYPES = ['cash', 'bank', 'mobile_money']

function defaultSubtype(type: string): string {
  if (type === 'cash') return 'cash'
  if (type === 'bank') return 'bank'
  return 'bkash'
}

// ── Account detail display ────────────────────────────────────────────────────

function AccountDetail({ acc }: { acc: Account }) {
  if (acc.type === 'mobile_money') {
    return (
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {acc.subtype && SUBTYPE_LABELS[acc.subtype] && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SUBTYPE_COLORS[acc.subtype] ?? 'bg-slate-100 text-slate-600'}`}>
            {SUBTYPE_LABELS[acc.subtype]}
          </span>
        )}
        {acc.account_phone && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Phone className="h-3 w-3" /> {acc.account_phone}
          </span>
        )}
      </div>
    )
  }
  if (acc.type === 'bank') {
    return (
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        {acc.bank_name && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Building2 className="h-3 w-3" /> {acc.bank_name}
          </span>
        )}
        {acc.account_number && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Hash className="h-3 w-3" /> {acc.account_number}
          </span>
        )}
      </div>
    )
  }
  return null
}

// ── Edit form extra fields ────────────────────────────────────────────────────

function AccountExtraFields({
  type, subtype, accountPhone, accountNumber, bankName,
  onChange,
}: {
  type: string
  subtype: string
  accountPhone: string
  accountNumber: string
  bankName: string
  onChange: (k: string, v: string) => void
}) {
  if (type === 'mobile_money') {
    return (
      <>
        <select
          value={subtype}
          onChange={e => onChange('subtype', e.target.value)}
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        >
          {MOBILE_SUBTYPES.map(s => (
            <option key={s} value={s}>{SUBTYPE_LABELS[s]}</option>
          ))}
        </select>
        <input
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="ফোন নম্বর (যেমন: 01712345678)"
          value={accountPhone}
          onChange={e => onChange('accountPhone', e.target.value)}
        />
      </>
    )
  }
  if (type === 'bank') {
    return (
      <>
        <input
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="ব্যাংকের নাম (যেমন: Dutch-Bangla Bank)"
          value={bankName}
          onChange={e => onChange('bankName', e.target.value)}
        />
        <input
          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="অ্যাকাউন্ট নম্বর"
          value={accountNumber}
          onChange={e => onChange('accountNumber', e.target.value)}
        />
      </>
    )
  }
  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', subtype: '', accountPhone: '', accountNumber: '', bankName: '',
  })

  // Add state
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', type: 'cash', subtype: 'cash', accountPhone: '', accountNumber: '', bankName: '',
  })

  const load = () => {
    setLoading(true)
    getAccountsWithBalance()
      .then(res => { if (res?.success) setAccounts((res.data as Account[]) ?? []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (acc: Account) => {
    setEditingId(acc.id)
    setEditForm({
      name: acc.name,
      subtype: acc.subtype || defaultSubtype(acc.type),
      accountPhone: acc.account_phone || '',
      accountNumber: acc.account_number || '',
      bankName: acc.bank_name || '',
    })
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (acc: Account) => {
    if (!editForm.name.trim()) return
    setSaving(true)
    const res = await updateAccount({
      id: acc.id,
      name: editForm.name,
      subtype: editForm.subtype || undefined,
      account_phone: editForm.accountPhone || undefined,
      account_number: editForm.accountNumber || undefined,
      bank_name: editForm.bankName || undefined,
    })
    setSaving(false)
    if (res?.success) {
      toast.success('অ্যাকাউন্ট আপডেট হয়েছে')
      setEditingId(null)
      load()
    } else {
      toast.error(res?.error || 'আপডেট ব্যর্থ হয়েছে')
    }
  }

  const handleDelete = async (acc: Account) => {
    if (!window.confirm(`"${acc.name}" অ্যাকাউন্টটি মুছে ফেলবেন?`)) return
    setSaving(true)
    const res = await deleteAccount({ id: acc.id })
    setSaving(false)
    if (res?.success) { toast.success('মুছে ফেলা হয়েছে'); load() }
    else toast.error(res?.error || 'মুছতে পারেনি')
  }

  const handleAdd = async () => {
    if (!addForm.name.trim()) return
    setSaving(true)
    const res = await createAccount({
      name: addForm.name,
      type: addForm.type,
      subtype: addForm.subtype || undefined,
      account_phone: addForm.accountPhone || undefined,
      account_number: addForm.accountNumber || undefined,
      bank_name: addForm.bankName || undefined,
    })
    setSaving(false)
    if (res?.success) {
      toast.success('নতুন অ্যাকাউন্ট তৈরি হয়েছে')
      setShowAdd(false)
      setAddForm({ name: '', type: 'cash', subtype: 'cash', accountPhone: '', accountNumber: '', bankName: '' })
      load()
    } else {
      toast.error(res?.error || 'তৈরি করতে পারেনি')
    }
  }

  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }))
  const setAdd = (k: string, v: string) => setAddForm(f => ({ ...f, [k]: v }))

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-slate-100" />)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {accounts.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">কোনো অ্যাকাউন্ট নেই</p>
      )}

      {accounts.map(acc => (
        <div key={acc.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {editingId === acc.id ? (
            <div className="p-3 space-y-2 bg-emerald-50/40">
              <input
                autoFocus
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="অ্যাকাউন্টের নাম"
                value={editForm.name}
                onChange={e => setEdit('name', e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
              />
              <AccountExtraFields
                type={acc.type}
                subtype={editForm.subtype}
                accountPhone={editForm.accountPhone}
                accountNumber={editForm.accountNumber}
                bankName={editForm.bankName}
                onChange={setEdit}
              />
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => saveEdit(acc)} disabled={saving || !editForm.name.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1" /> সেভ
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                  <X className="h-3.5 w-3.5 mr-1" /> বাতিল
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[acc.type] ?? 'bg-slate-100 text-slate-600'}`}>
                  {TYPE_LABELS[acc.type] ?? acc.type}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-800">{acc.name}</span>
                <span className="shrink-0 text-sm font-medium text-slate-600">
                  ৳{Number(acc.current_balance).toLocaleString('en-IN')}
                </span>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => startEdit(acc)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc)}
                    disabled={saving || Number(acc.current_balance) !== 0}
                    title={Number(acc.current_balance) !== 0 ? 'ব্যালেন্স শূন্য না হলে মুছবে না' : 'মুছে ফেলুন'}
                    className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <AccountDetail acc={acc} />
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {showAdd ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={addForm.type}
              onChange={e => {
                const t = e.target.value
                setAddForm(f => ({ ...f, type: t, subtype: defaultSubtype(t) }))
              }}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              autoFocus
              className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="অ্যাকাউন্টের নাম"
              value={addForm.name}
              onChange={e => setAdd('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setShowAdd(false) }}
            />
          </div>
          <AccountExtraFields
            type={addForm.type}
            subtype={addForm.subtype}
            accountPhone={addForm.accountPhone}
            accountNumber={addForm.accountNumber}
            bankName={addForm.bankName}
            onChange={setAdd}
          />
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={saving || !addForm.name.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-3.5 w-3.5 mr-1" /> যোগ করুন
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddForm({ name: '', type: 'cash', subtype: 'cash', accountPhone: '', accountNumber: '', bankName: '' }) }}>
              <X className="h-3.5 w-3.5 mr-1" /> বাতিল
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          নতুন অ্যাকাউন্ট যোগ করুন
        </button>
      )}
    </div>
  )
}
