'use client'

import { useState } from 'react'
import { createFeatureFlag } from '@/domains/admin/feature-flags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function CreateFlagForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [id, setId] = useState('')
  const [description, setDescription] = useState('')
  const [isGlobal, setIsGlobal] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await createFeatureFlag({ id, description, isGlobalEnabled: isGlobal })
      setOpen(false)
      setId('')
      setDescription('')
      setIsGlobal(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="w-4 h-4 mr-2" />
        Create Flag
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
          <DialogDescription>
            Define a new feature flag. Use snake_case for the ID (e.g. new_dashboard).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="id">Flag ID</Label>
            <Input 
              id="id"
              value={id}
              onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. ai_assistant"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this flag control?"
              required
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-md bg-slate-50">
            <div className="space-y-0.5">
              <Label>Enable Globally</Label>
              <div className="text-sm text-slate-500">Enable for all users by default</div>
            </div>
            <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !id || !description}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Flag
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
