import { createClient } from '@/lib/supabase/server'
import { FileText, Eye, Search, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminInvoicesPage() {
  const supabase = await createClient()

  // Fetch all invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, business:businesses(name)')
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            SaaS Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage global subscription invoices and billing records.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by invoice number or business..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Invoice Number</th>
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!invoices || invoices.length === 0) ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {invoice.invoice_number || `INV-${invoice.id.substring(0, 8).toUpperCase()}`}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {invoice.business?.name || 'Unknown Business'}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {invoice.plan_name || 'Subscription'}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ৳{invoice.amount_due}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
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
