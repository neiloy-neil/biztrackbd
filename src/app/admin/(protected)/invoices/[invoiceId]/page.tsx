import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Mail, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { AdminInvoiceActionsClient } from './AdminInvoiceActionsClient'

export default async function AdminInvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  
  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.invoices.view' })
  if (!hasPermission) redirect('/admin/dashboard')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, business:businesses(*)')
    .eq('id', params.invoiceId)
    .single()

  if (error || !invoice) {
    notFound()
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

  const invoiceNumber = invoice.invoice_number || `INV-${invoice.id.substring(0, 8).toUpperCase()}`

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoice {invoiceNumber}</h1>
          {getStatusBadge(invoice.status)}
        </div>
        <div className="flex items-center gap-2">
          <AdminInvoiceActionsClient invoiceId={invoice.id} status={invoice.status} />
          <Button variant="outline" className="gap-2">
            <Mail className="w-4 h-4" />
            Resend Email
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">INVOICE</h1>
                <p className="text-slate-500 mt-1">BizTrack BD Platform</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Invoice Number</p>
                <p className="text-lg font-semibold text-slate-900">{invoiceNumber}</p>
                <p className="text-sm font-medium text-slate-500 mt-4">Date of Issue</p>
                <p className="text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium text-slate-500 mb-1">Billed To:</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">{invoice.business?.name}</p>
                <Link href={`/admin/businesses/${invoice.business_id}`} target="_blank">
                  <span className="text-indigo-500 text-xs hover:underline cursor-pointer">View Business</span>
                </Link>
              </div>
              <p className="text-sm text-slate-500 mt-1">Business ID: {invoice.business_id}</p>
            </div>

            <div className="mb-8">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium rounded-tl-lg rounded-bl-lg">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-4 py-3 font-medium text-right rounded-tr-lg rounded-br-lg">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{invoice.plan_name || 'SaaS Subscription Plan'}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">{invoice.quantity || 1}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-900">৳{Number(invoice.amount_due) + Number(invoice.discount_amount || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-8">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-100">
                  <span>Total</span>
                  <span>৳{invoice.amount_due}</span>
                </div>
                <div className="flex justify-between text-indigo-600 font-bold pt-1">
                  <span>Balance Due</span>
                  <span>৳{Math.max(0, Number(invoice.amount_due) - Number(invoice.amount_paid))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & Metadata */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Payment Details</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500 font-medium">Payment Status</dt>
                <dd className="mt-1">{getStatusBadge(invoice.status)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Amount Paid</dt>
                <dd className="mt-1 font-semibold text-slate-900">৳{invoice.amount_paid}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Payment Method</dt>
                <dd className="mt-1 text-slate-900 capitalize">{invoice.payment_method || 'N/A'}</dd>
              </div>
              {invoice.paid_date && (
                <div>
                  <dt className="text-slate-500 font-medium">Paid Date</dt>
                  <dd className="mt-1 text-slate-900">{new Date(invoice.paid_date).toLocaleString()}</dd>
                </div>
              )}
              {invoice.uddoktapay_invoice_id && (
                <div>
                  <dt className="text-slate-500 font-medium">Gateway ID</dt>
                  <dd className="mt-1 text-xs font-mono text-slate-500 bg-slate-50 p-2 rounded">{invoice.uddoktapay_invoice_id}</dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Audit Log / History could go here */}
        </div>
      </div>
    </div>
  )
}
