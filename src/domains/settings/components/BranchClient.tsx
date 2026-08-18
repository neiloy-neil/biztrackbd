'use client'

import { useState, useEffect } from 'react'
import { Pencil, Trash2, Plus, Check, X, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getBranches, createBranch, updateBranch, deleteBranch } from '../actions'

type Branch = { id: string; name: string; address?: string; phone?: string }

export function BranchClient() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Branch>>({})
  
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', address: '', phone: '' })
  
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getBranches()
      .then(res => { if (res?.success) setBranches((res.data as Branch[]) ?? []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setEditForm({ name: branch.name, address: branch.address || '', phone: branch.phone || '' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name?.trim()) return
    setSaving(true)
    const res = await updateBranch({
      id,
      name: editForm.name,
      address: editForm.address,
      phone: editForm.phone
    })
    setSaving(false)
    if (res?.success) {
      toast.success('ব্রাঞ্চ আপডেট হয়েছে')
      cancelEdit()
      load()
    } else {
      toast.error(res?.error || 'আপডেট ব্যর্থ হয়েছে')
    }
  }

  const handleAdd = async () => {
    if (!newForm.name.trim()) return
    setSaving(true)
    const res = await createBranch({
      name: newForm.name,
      address: newForm.address,
      phone: newForm.phone
    })
    setSaving(false)
    if (res?.success) {
      toast.success('নতুন ব্রাঞ্চ যোগ করা হয়েছে')
      setNewForm({ name: '', address: '', phone: '' })
      setShowAdd(false)
      load()
    } else {
      toast.error(res?.error || 'যোগ করতে ব্যর্থ হয়েছে')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('সত্যিই এই ব্রাঞ্চ ডিলিট করতে চান?')) return
    const res = await deleteBranch({ id })
    if (res?.success) {
      toast.success('ব্রাঞ্চ ডিলিট হয়েছে')
      load()
    } else {
      toast.error(res?.error || 'ডিলিট করা যায়নি')
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 py-4">লোড হচ্ছে...</div>
  }

  return (
    <div className="space-y-4">
      {branches.map(branch => (
        <div key={branch.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:border-emerald-200 transition-colors bg-slate-50">
          {editingId === branch.id ? (
            <div className="space-y-2">
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ব্রাঞ্চের নাম"
                className="h-9"
              />
              <Input
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                placeholder="ঠিকানা"
                className="h-9"
              />
              <Input
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="ফোন নম্বর"
                className="h-9"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSaveEdit(branch.id)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check className="h-4 w-4 mr-1" /> সেভ
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> বাতিল
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800">{branch.name}</p>
                {branch.address && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {branch.address}
                  </p>
                )}
                {branch.phone && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    ফোন: {branch.phone}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => startEdit(branch)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600" onClick={() => handleDelete(branch.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="p-3 border rounded-lg bg-emerald-50/50 space-y-2 border-emerald-100">
          <Input
            value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ব্রাঞ্চের নাম (যেমন: মিরপুর ব্রাঞ্চ)"
            className="h-9"
            autoFocus
          />
          <Input
            value={newForm.address}
            onChange={e => setNewForm(f => ({ ...f, address: e.target.value }))}
            placeholder="ঠিকানা (ঐচ্ছিক)"
            className="h-9"
          />
          <Input
            value={newForm.phone}
            onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="ফোন নম্বর (ঐচ্ছিক)"
            className="h-9"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newForm.name.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-4 w-4 mr-1" /> যোগ করুন
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> বাতিল
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />
          নতুন ব্রাঞ্চ যোগ করুন
        </Button>
      )}
    </div>
  )
}
