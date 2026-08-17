import { fetchInvoices } from '@/domains/billing/actions'
import { Badge } from '@/components/ui/badge'
import { Receipt, FileText, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function InvoicesPage() {
  const response = await fetchInvoices()
  const invoices = response.success ? response.data : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/app/settings/billing" 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            Billing History
          </h2>
          <p className="text-sm text-gray-500">View and download your past subscription invoices.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>No invoices found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-medium">Invoice Number</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{inv.number || `#${inv.id.slice(0, 8)}`}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(inv.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      ৳{inv.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'open' ? 'secondary' : 'outline'}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.hosted_invoice_url ? (
                        <a 
                          href={inv.hosted_invoice_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
