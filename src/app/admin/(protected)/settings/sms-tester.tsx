'use client'

import { useState } from 'react'
import { MessageSquare, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { testSmsGateway } from '@/domains/admin/actions'

export function SmsGatewayTester() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    const res = await testSmsGateway({ phone })
    setResult(
      res.success
        ? { ok: true, message: `Sent to ${(res.data as any)?.to}. Check the phone for the test message.` }
        : { ok: false, message: res.error || 'Unknown error' }
    )
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-base">SMS Gateway (sms.net.bd)</CardTitle>
        </div>
        <CardDescription>
          Send a test SMS to verify the gateway is working before go-live. Uses the live{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">SMS_NET_BD_API_KEY</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleTest} className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="test-phone" className="text-sm">Phone number</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">+880</span>
              <Input
                id="test-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1700000000"
                required
                className="pl-12"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading || phone.length < 10}
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
              : 'Send Test SMS'}
          </Button>
        </form>

        {result && (
          <div className={`mt-4 flex items-start gap-2 p-3 rounded-lg text-sm ${
            result.ok
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {result.ok
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              : <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
