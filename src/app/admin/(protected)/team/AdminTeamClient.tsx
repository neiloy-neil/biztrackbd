'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { invitePlatformAdminAction, updatePlatformAdminRoleAction, removePlatformAdminAction } from '@/domains/admin/team.actions'
import { format } from 'date-fns'

export function AdminTeamClient({ admins, currentUserEmail }: { admins: any[], currentUserEmail: string }) {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('support')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const [editUser, setEditUser] = useState<any>(null)
  const [editRole, setEditRole] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    
    const res = await invitePlatformAdminAction({ email: inviteEmail, roleName: inviteRole })
    if (res?.success) {
      setIsInviteOpen(false)
      setInviteEmail('')
      setInviteRole('support')
    } else {
      setInviteError(res?.error || 'Failed to invite admin')
    }
    setInviteLoading(false)
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditLoading(true)
    
    const res = await updatePlatformAdminRoleAction({ userId: editUser.user_id, roleName: editRole })
    if (res?.success) {
      setEditUser(null)
    }
    setEditLoading(false)
  }

  async function handleRemove(userId: string, email: string) {
    if (email === currentUserEmail) {
      alert("You cannot remove yourself.")
      return
    }
    if (confirm(`Are you sure you want to revoke platform access for ${email}?`)) {
      await removePlatformAdminAction({ userId })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Platform Team</CardTitle>
          <CardDescription>Manage staff who have access to the platform dashboard.</CardDescription>
        </div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger className={buttonVariants({ variant: 'default' })}>
            Invite Admin
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Platform Admin</DialogTitle>
              <DialogDescription>
                Send an invitation email or grant access to an existing user.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  placeholder="admin@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Platform Role</Label>
                <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as string)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.admin_id}>
                <TableCell className="font-medium">
                  {admin.email}
                  {admin.email === currentUserEmail && (
                    <Badge variant="outline" className="ml-2">You</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={admin.role_name === 'super_admin' ? 'destructive' : 'secondary'}>
                    {admin.role_name.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(admin.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditUser(admin)
                      setEditRole(admin.role_name)
                    }}
                  >
                    Change Role
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleRemove(admin.user_id, admin.email)}
                    disabled={admin.email === currentUserEmail}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                  No platform admins found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Edit Role Dialog */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
              <DialogDescription>
                Update the platform role for {editUser?.email}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Platform Role</Label>
                <Select value={editRole} onValueChange={(val) => setEditRole(val as string)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
