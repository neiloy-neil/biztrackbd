'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Check, X, MapPin, Phone, UserCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getStaffWithBranchId,
  assignStaffToBranch,
} from '../actions'

type Branch = { id: string; name: string; address?: string; phone?: string }

type StaffMember = {
  user_id: string
  full_name: string
  phone: string
  role: string
  branch_id: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner:   'Owner',
  manager: 'Manager',
  staff:   'Staff',
  cashier: 'Cashier',
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-amber-100  text-amber-700',
  manager: 'bg-blue-100   text-blue-700',
  staff:   'bg-slate-100  text-slate-600',
  cashier: 'bg-teal-100   text-teal-700',
}

// ── Staff chip (per employee assigned to a branch) ────────────────────────────

function StaffChip({
  member,
  onUnassign,
  disabled,
}: {
  member: StaffMember
  onUnassign: (userId: string) => void
  disabled: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 pr-1 pl-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-medium text-slate-700">
      <UserCircle className="h-3 w-3 text-slate-400 shrink-0" />
      {member.full_name}
      <span className={`text-[10px] px-1 rounded-full ${ROLE_COLORS[member.role] ?? ROLE_COLORS.staff}`}>
        {ROLE_LABELS[member.role] ?? member.role}
      </span>
      <button
        onClick={() => onUnassign(member.user_id)}
        disabled={disabled}
        className="rounded-full p-0.5 hover:bg-rose-100 hover:text-rose-500 text-slate-400 disabled:opacity-40 transition-colors"
        title="আনঅ্যাসাইন করুন"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

// ── Assign Employee Dialog ────────────────────────────────────────────────────

function AssignDialog({
  branchId,
  allStaff,
  onAssigned,
}: {
  branchId: string
  allStaff: StaffMember[]
  onAssigned: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Show all staff except those already assigned to THIS branch
  const candidates = allStaff.filter(m => m.branch_id !== branchId)

  const handleAssign = async (userId: string) => {
    setSaving(true)
    const res = await assignStaffToBranch({ staffId: userId, branchId })
    setSaving(false)
    if (res?.success) {
      toast.success('কর্মী অ্যাসাইন হয়েছে')
      setOpen(false)
      onAssigned()
    } else {
      toast.error(res?.error || 'অ্যাসাইন করা যায়নি')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
        <UserPlus className="h-3 w-3" />
        কর্মী যোগ করুন
      </DialogTrigger>
      <DialogContent className="max-w-sm">
          <DialogTitle className="text-base font-semibold text-slate-800 mb-3">কর্মী অ্যাসাইন করুন</DialogTitle>
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">সব কর্মী ইতিমধ্যে এই ব্রাঞ্চে আছে বা অন্য ব্রাঞ্চে আছে।</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {candidates.map(m => (
                <button
                  key={m.user_id}
                  onClick={() => handleAssign(m.user_id)}
                  disabled={saving}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-emerald-50 text-left transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <UserCircle className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.full_name}</p>
                    {m.phone && <p className="text-xs text-slate-500">{m.phone}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[m.role] ?? ROLE_COLORS.staff}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {m.branch_id && (
                    <span className="text-[10px] text-slate-400 shrink-0">অন্য ব্রাঞ্চে</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <DialogClose className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors">বাতিল</DialogClose>
          </div>
        </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BranchClient() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Branch>>({})

  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', address: '', phone: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getBranches(), getStaffWithBranchId()])
      .then(([bRes, sRes]) => {
        if (bRes?.success) setBranches((bRes.data as Branch[]) ?? [])
        if (sRes?.success) setAllStaff((sRes.data as StaffMember[]) ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (branch: Branch) => {
    setEditingId(branch.id)
    setEditForm({ name: branch.name, address: branch.address || '', phone: branch.phone || '' })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm({}) }

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name?.trim()) return
    setSaving(true)
    const res = await updateBranch({ id, name: editForm.name!, address: editForm.address, phone: editForm.phone })
    setSaving(false)
    if (res?.success) { toast.success('ব্রাঞ্চ আপডেট হয়েছে'); cancelEdit(); load() }
    else toast.error(res?.error || 'আপডেট ব্যর্থ হয়েছে')
  }

  const handleAdd = async () => {
    if (!newForm.name.trim()) return
    setSaving(true)
    const res = await createBranch({ name: newForm.name, address: newForm.address, phone: newForm.phone })
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
    if (!confirm('সত্যিই এই ব্রাঞ্চ মুছে ফেলবেন?')) return
    const res = await deleteBranch({ id })
    if (res?.success) { toast.success('ব্রাঞ্চ মুছে ফেলা হয়েছে'); load() }
    else toast.error(res?.error || 'মুছতে পারেনি')
  }

  const handleUnassign = async (userId: string) => {
    setSaving(true)
    const res = await assignStaffToBranch({ staffId: userId, branchId: null })
    setSaving(false)
    if (res?.success) { toast.success('কর্মী আনঅ্যাসাইন হয়েছে'); load() }
    else toast.error(res?.error || 'আনঅ্যাসাইন করা যায়নি')
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-slate-100" />)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {branches.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">কোনো ব্রাঞ্চ নেই</p>
      )}

      {branches.map(branch => {
        const branchStaff = allStaff.filter(m => m.branch_id === branch.id)

        return (
          <div key={branch.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {editingId === branch.id ? (
              <div className="p-3 space-y-2 bg-emerald-50/40">
                <Input
                  autoFocus
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ব্রাঞ্চের নাম"
                  className="h-9"
                />
                <Input
                  value={editForm.address ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="ঠিকানা (ঐচ্ছিক)"
                  className="h-9"
                />
                <Input
                  value={editForm.phone ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="ফোন নম্বর (ঐচ্ছিক)"
                  className="h-9"
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => handleSaveEdit(branch.id)} disabled={saving || !editForm.name?.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Check className="h-3.5 w-3.5 mr-1" /> সেভ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3.5 w-3.5 mr-1" /> বাতিল
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2.5">
                {/* Branch info row */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{branch.name}</p>
                    <div className="flex items-center gap-3 flex-wrap mt-0.5">
                      {branch.address && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> {branch.address}
                        </span>
                      )}
                      {branch.phone && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="h-3 w-3" /> {branch.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => startEdit(branch)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(branch.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Staff chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {branchStaff.map(m => (
                    <StaffChip key={m.user_id} member={m} onUnassign={handleUnassign} disabled={saving} />
                  ))}
                  <AssignDialog
                    branchId={branch.id}
                    allStaff={allStaff}
                    onAssigned={load}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add form */}
      {showAdd ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
          <Input
            autoFocus
            value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ব্রাঞ্চের নাম (যেমন: মিরপুর ব্রাঞ্চ)"
            className="h-9"
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
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newForm.name.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="h-3.5 w-3.5 mr-1" /> যোগ করুন
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setNewForm({ name: '', address: '', phone: '' }) }}>
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
          নতুন ব্রাঞ্চ যোগ করুন
        </button>
      )}
    </div>
  )
}
