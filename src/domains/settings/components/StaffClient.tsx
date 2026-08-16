'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addStaff, updateStaffRole, removeStaff } from '../actions'
import { toast } from 'sonner'
import { User, Shield, Trash2, Edit2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { RequirePermission } from '@/hooks/usePermissions'

type StaffMember = {
  user_id: string
  role: string
  full_name: string
  phone: string
  joined_at: string
}

export function StaffClient({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('+880')
  const [newRole, setNewRole] = useState('staff')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editUser, setEditUser] = useState<StaffMember | null>(null)
  const [editRole, setEditRole] = useState('')

  const handleAddStaff = async () => {
    setIsSubmitting(true)
    const res = await addStaff({ phone: newPhone, role: newRole })
    setIsSubmitting(false)
    
    if (res?.success) {
      toast.success('স্টাফ যোগ করা হয়েছে')
      setIsAddOpen(false)
      // Optimistic or refresh - since we use server actions, revalidatePath will refresh the page on next load,
      // but client needs a hard refresh or we just reload.
      window.location.reload()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const handleUpdateRole = async () => {
    if (!editUser) return
    setIsSubmitting(true)
    const res = await updateStaffRole({ user_id: editUser.user_id, new_role: editRole })
    setIsSubmitting(false)
    
    if (res?.success) {
      toast.success('রোল আপডেট করা হয়েছে')
      setEditUser(null)
      window.location.reload()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const handleRemove = async (user_id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই স্টাফকে মুছে ফেলতে চান?')) return
    
    const res = await removeStaff({ user_id })
    if (res?.success) {
      toast.success('স্টাফ মুছে ফেলা হয়েছে')
      window.location.reload()
    } else {
      toast.error(res?.error || 'ব্যর্থ হয়েছে')
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'মালিক (Owner)',
    manager: 'ম্যানেজার (Manager)',
    cashier: 'ক্যাশিয়ার (Cashier)',
    staff: 'স্টাফ (Staff)'
  }

  return (
    <>
      <Card className="border-none shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">বর্তমান স্টাফ</CardTitle>
          <RequirePermission permission="staff.manage">
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
                  <RequirePermission permission="staff.manage">
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
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>নতুন স্টাফ যোগ করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ফোন নম্বর (স্টাফের অ্যাকাউন্টের)</label>
              <Input 
                value={newPhone} 
                onChange={(e) => setNewPhone(e.target.value)} 
                placeholder="+8801XXXXXXXXX"
              />
              <p className="text-[11px] text-slate-500">নোট: স্টাফকে আগে অ্যাপে রেজিস্ট্রেশন করতে হবে।</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">রোল নির্ধারণ করুন</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="রোল নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">ম্যানেজার (সবকিছু এক্সেস)</SelectItem>
                  <SelectItem value="cashier">ক্যাশিয়ার (শুধু বিক্রি)</SelectItem>
                  <SelectItem value="staff">স্টাফ (শুধু দেখা)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>বাতিল</Button>
            <Button onClick={handleAddStaff} disabled={isSubmitting}>যোগ করুন</Button>
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
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue placeholder="রোল নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">ম্যানেজার (সবকিছু এক্সেস)</SelectItem>
                  <SelectItem value="cashier">ক্যাশিয়ার (শুধু বিক্রি)</SelectItem>
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
