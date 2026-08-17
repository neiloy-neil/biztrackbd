import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, Download, Printer, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function TenantInvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, business:businesses(name)')
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/app/settings/billing/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Invoice {invoiceNumber}</h2>
          {getStatusBadge(invoice.status)}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">INVOICE</h1>
            <p className="text-slate-500 mt-1">BizTrack BD</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-500">Invoice Number</p>
            <p className="text-lg font-semibold text-slate-900">{invoiceNumber}</p>
            <p className="text-sm font-medium text-slate-500 mt-4">Date of Issue</p>
            <p className="text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
            <p className="text-sm font-medium text-slate-500 mt-4">Due Date</p>
            <p className="text-slate-900">{new Date(invoice.due_date).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500 mb-1">Billed To:</p>
          <p className="text-lg font-semibold text-slate-900">{invoice.business?.name}</p>
        </div>

        {/* Invoice Items */}
        <div className="mb-8">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium rounded-tl-lg rounded-bl-lg">Description</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                <th className="px-4 py-3 font-medium text-right rounded-tr-lg rounded-br-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">{invoice.plan_name || 'SaaS Subscription Plan'}</p>
                  {(invoice.billing_period_start && invoice.billing_period_end) && (
                    <p className="text-slate-500 text-xs mt-1">
                      Billing Period: {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 text-right text-slate-700">{invoice.quantity || 1}</td>
                <td className="px-4 py-4 text-right text-slate-700">৳{Number(invoice.amount_due) + Number(invoice.discount_amount || 0)}</td>
                <td className="px-4 py-4 text-right font-medium text-slate-900">৳{Number(invoice.amount_due) + Number(invoice.discount_amount || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end border-t border-slate-100 pt-8">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Subtotal</span>
              <span>৳{Number(invoice.amount_due) + Number(invoice.discount_amount || 0) - Number(invoice.tax_amount || 0)}</span>
            </div>
            {(invoice.discount_amount > 0) && (
              <div className="flex justify-between text-slate-500 text-sm">
                <span>Discount</span>
                <span>-৳{invoice.discount_amount}</span>
              </div>
            )}
            {(invoice.tax_amount > 0) && (
              <div className="flex justify-between text-slate-500 text-sm">
                <span>Tax</span>
                <span>+৳{invoice.tax_amount}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-100">
              <span>Total</span>
              <span>৳{invoice.amount_due}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-sm pt-1">
              <span>Amount Paid</span>
              <span>৳{invoice.amount_paid}</span>
            </div>
            <div className="flex justify-between text-indigo-600 font-bold pt-1">
              <span>Balance Due</span>
              <span>৳{Math.max(0, Number(invoice.amount_due) - Number(invoice.amount_paid))}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-16 pt-8 border-t border-slate-100 text-center text-sm text-slate-500">
          <p>Thank you for doing business with BizTrack BD.</p>
          <p className="mt-1">For any inquiries, please contact support@biztrackbd.com</p>
        </div>
      </div>
    </div>
  )
}
