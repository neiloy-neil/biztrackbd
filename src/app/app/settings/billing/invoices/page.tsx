import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Download, Eye, Printer, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function TenantInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active business for the current user
  const { data: staffData } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    
  if (!staffData || staffData.length === 0) {
    return <div className="p-8 text-center text-slate-500">You are not assigned to a business.</div>
  }
  const businessId = staffData[0].business_id

  // Fetch invoices for this business
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching invoices:', error)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Paid</Badge>
      case 'open': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Open</Badge>
      case 'past_due': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Past Due</Badge>
      case 'draft': return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200">Draft</Badge>
      case 'void': return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200">Void</Badge>
      case 'refunded': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Refunded</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-6 h-6 text-slate-700" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Invoice Number</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!invoices || invoices.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {invoice.invoice_number || `INV-${invoice.id.substring(0, 8).toUpperCase()}`}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {invoice.plan_name || 'Subscription'}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ৳{invoice.amount_due}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/app/settings/billing/invoices/${invoice.id}`}>
                          <Button variant="ghost" size="icon" title="View">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
