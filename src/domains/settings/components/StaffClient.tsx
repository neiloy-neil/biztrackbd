'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createStaffAccount, updateStaffRole, removeStaff } from '../actions'
import { toast } from 'sonner'
import { User, Shield, Trash2, Edit2, Eye, EyeOff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { RequirePermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/auth/rbac'

type StaffMember = {
  user_id: string
  role: string
  full_name: string
  phone: string
  joined_at: string
}

export function StaffClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const router = useRouter()
  const [staffList] = useState<StaffMember[]>(initialStaff)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [editUser, setEditUser] = useState<StaffMember | null>(null)
  const [editRole, setEditRole] = useState('')

  // Add staff form state
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPin, setNewPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [newRole, setNewRole] = useState('staff')

  const resetAddForm = () => {
    setNewName('')
    setNewPhone('')
    setNewPin('')
    setShowPin(false)
    setNewRole('staff')
  }

  const handleAddStaff = async () => {
    setIsSubmitting(true)
    const res = await createStaffAccount({ name: newName, phone: newPhone, pin: newPin, role: newRole })
    setIsSubmitting(false)

    if (res?.success) {
      toast.success('স্টাফ অ্যাকাউন্ট তৈরি হয়েছে')
      setIsAddOpen(false)
      resetAddForm()
      router.refresh()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const handleUpdateRole = async () => {
    if (!editUser) return
    setIsSubmitting(true)
    const res = await updateStaffRole({ user_id: editUser.user_id, new_role: editRole })
    setIsSubmitting(false)

    if (res?.success) {
      toast.success('রোল আপডেট করা হয়েছে')
      setEditUser(null)
      router.refresh()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const handleRemove = async (user_id: string) => {
    if (confirmDeleteId !== user_id) {
      setConfirmDeleteId(user_id)
      toast.info('ডিলিট নিশ্চিত করতে আবার ট্যাপ করুন', { duration: 3000 })
      setTimeout(() => setConfirmDeleteId(null), 3000)
      return
    }
    setConfirmDeleteId(null)
    const res = await removeStaff({ user_id })
    if (res?.success) {
      toast.success('স্টাফ মুছে ফেলা হয়েছে')
      router.refresh()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'মালিক (Owner)',
    manager: 'ম্যানেজার (Manager)',
    cashier: 'ক্যাশিয়ার (Cashier)',
    staff: 'স্টাফ (Staff)'
  }

  const canAdd = newName.trim().length > 0 && newPhone.trim().length > 0 && newPin.length >= 4

  return (
    <>
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">বর্তমান স্টাফ</CardTitle>
          <RequirePermission permission={PERMISSIONS.STAFF_MANAGE}>
            <Button size="sm" onClick={() => setIsAddOpen(true)}>নতুন স্টাফ যোগ করুন</Button>
          </RequirePermission>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100 mt-2">
            {staffList.map((staff) => (
              <div key={staff.user_id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{staff.full_name}</p>
                    <p className="text-xs text-slate-500">{staff.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                    <Shield className="w-3 h-3" /> {roleLabels[staff.role] || staff.role}
                  </div>
                  <RequirePermission permission={PERMISSIONS.STAFF_MANAGE}>
                    {staff.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                          setEditUser(staff)
                          setEditRole(staff.role)
                        }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleRemove(staff.user_id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </RequirePermission>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetAddForm(); setIsAddOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>নতুন স্টাফ অ্যাকাউন্ট তৈরি করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">পুরো নাম</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="যেমন: রাহেলা বেগম"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">ফোন নম্বর</label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                type="tel"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">লগইন পিন (৪-৬ সংখ্যা)</label>
              <div className="relative">
                <Input
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="স্টাফ এই পিন দিয়ে লগইন করবে"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">স্টাফ এই ফোন নম্বর ও পিন দিয়ে লগইন করবে। পরে পিন পরিবর্তন করা যাবে।</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">রোল নির্ধারণ করুন</label>
              <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="রোল নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">ম্যানেজার (সবকিছু এক্সেস)</SelectItem>
                  <SelectItem value="cashier">ক্যাশিয়ার (শুধু বিক্রি)</SelectItem>
                  <SelectItem value="staff">স্টাফ (শুধু দেখা)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetAddForm(); setIsAddOpen(false) }}>বাতিল</Button>
            <Button onClick={handleAddStaff} disabled={isSubmitting || !canAdd}>
              {isSubmitting ? 'তৈরি হচ্ছে...' : 'অ্যাকাউন্ট তৈরি করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>রোল আপডেট করুন ({editUser?.full_name})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">নতুন রোল নির্বাচন করুন</label>
              <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="রোল নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">ম্যানেজার (সবকিছু এক্সেস)</SelectItem>
                  <SelectItem value="cashier">ক্যাশিয়ার (শুধু বিক্রি)</SelectItem>
                  <SelectItem value="staff">স্টাফ (শুধু দেখা)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>বাতিল</Button>
            <Button onClick={handleUpdateRole} disabled={isSubmitting}>আপডেট করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
