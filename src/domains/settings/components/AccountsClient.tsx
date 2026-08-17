'use client'

import { useState, useEffect } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getAccountsWithBalance, createAccount, updateAccount, deleteAccount } from '../actions'

type Account = { id: string; name: string; type: string; current_balance: number }

const TYPE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  mobile_money: 'Mobile Money',
}

const TYPE_COLORS: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  bank: 'bg-blue-100 text-blue-700',
  mobile_money: 'bg-pink-100 text-pink-700',
}

const ACCOUNT_TYPES = ['cash', 'bank', 'mobile_money']

export function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('cash')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getAccountsWithBalance()
      .then(res => { if (res?.success) setAccounts((res.data as Account[]) ?? []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (acc: Account) => {
    setEditingId(acc.id)
    setEditName(acc.name)
  }

  const cancelEdit = () => { setEditingId(null); setEditName('') }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    const res = await updateAccount({ id, name: editName })
    setSaving(false)
    if (res?.success) {
      toast.success('নাম আপডেট হয়েছে')
      setEditingId(null)
      load()
    } else {
      toast.error(res?.error || 'Failed to update')
    }
  }

  const handleDelete = async (acc: Account) => {
    if (!window.confirm(`"${acc.name}" অ্যাকাউন্টটি মুছে ফেলবেন?`)) return
    setSaving(true)
    const res = await deleteAccount({ id: acc.id })
    setSaving(false)
    if (res?.success) {
      toast.success('অ্যাকাউন্ট মুছে ফেলা হয়েছে')
      load()
    } else {
      toast.error(res?.error || 'Failed to delete')
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const res = await createAccount({ name: newName, type: newType })
    setSaving(false)
    if (res?.success) {
      toast.success('নতুন অ্যাকাউন্ট তৈরি হয়েছে')
      setShowAdd(false)
      setNewName('')
      setNewType('cash')
      load()
    } else {
      toast.error(res?.error || 'Failed to create')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">কোনো অ্যাকাউন্ট নেই</p>
      )}

      {accounts.map(acc => (
        <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[acc.type] ?? 'bg-slate-100 text-slate-600'}`}>
            {TYPE_LABELS[acc.type] ?? acc.type}
          </span>

          {editingId === acc.id ? (
            <input
              autoFocus
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(acc.id); if (e.key === 'Escape') cancelEdit() }}
            />
          ) : (
            <span className="flex-1 text-sm font-medium text-slate-800">{acc.name}</span>
          )}

          <span className="shrink-0 text-xs text-slate-400">
            ৳{Number(acc.current_balance).toLocaleString('en-IN')}
          </span>

          {editingId === acc.id ? (
            <div className="flex gap-1">
              <button onClick={() => saveEdit(acc.id)} disabled={saving} className="rounded p-1 text-emerald-600 hover:bg-emerald-50">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={cancelEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => startEdit(acc)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(acc)}
                disabled={saving || Number(acc.current_balance) !== 0}
                title={Number(acc.current_balance) !== 0 ? 'ব্যালেন্স শূন্য না হলে মুছবে না' : 'মুছে ফেলুন'}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
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
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false) }}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              যোগ করুন
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewName('') }}>
              বাতিল
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          নতুন অ্যাকাউন্ট যোগ করুন
        </button>
      )}
    </div>
  )
}
