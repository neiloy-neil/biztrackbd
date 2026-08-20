import { Suspense } from 'react'
import { getMushak63Report } from '@/domains/reports/vat-actions'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'

export const dynamic = 'force-dynamic'

export default async function Mushak63Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { id } = params
  
  if (!id) notFound()

  const res = await getMushak63Report({ invoiceId: id })
  
  if (!res.success || !res.data) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Error loading Mushak 6.3 report: {('error' in res ? res.error : 'Unknown error')}
        </div>
        <Link href="/app/pos">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
        </Link>
      </div>
    )
  }

  const { data } = res
  const { business_info, customer_info, items, summary } = data
  const isInclusive = data.pricing_model === 'inclusive'

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <div className="max-w-4xl mx-auto p-4 flex items-center justify-between no-print">
        <Link href="/app/pos">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to POS</Button>
        </Link>
        <Button onClick={() => typeof window !== 'undefined' && window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Printer className="mr-2 h-4 w-4" /> Print Mushak-6.3
        </Button>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-sm border print-mushak" id="mushak-print">
        <div className="text-center space-y-2 mb-8 border-b pb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">Government of the People's Republic of Bangladesh</h1>
          <h2 className="text-lg font-semibold">National Board of Revenue</h2>
          <h3 className="text-xl font-bold mt-2">Tax Invoice (Mushak-6.3)</h3>
          <p className="text-sm text-slate-500">[See clauses (c) and (f) of Sub-Rule (1) of Rule 40]</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Registered Person's Details</h4>
            <p><strong>Name:</strong> BizTrack BD</p>
            <p><strong>BIN:</strong> {business_info.bin || 'N/A'}</p>
            <p><strong>Issue Date:</strong> {new Date(data.issue_date).toLocaleDateString()}</p>
          </div>
          
          <div className="space-y-1 text-right">
            <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Purchaser's Details</h4>
            <p><strong>Name:</strong> {customer_info?.name || 'Walk-in Customer'}</p>
            <p><strong>BIN:</strong> {customer_info?.bin || 'N/A'}</p>
            <p><strong>Invoice No:</strong> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{data.tax_invoice_number || 'N/A'}</span></p>
          </div>
        </div>

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="bg-slate-50 border-y">
              <th className="py-3 px-4 text-left font-semibold">S/N</th>
              <th className="py-3 px-4 text-left font-semibold">Description</th>
              <th className="py-3 px-4 text-center font-semibold">HS Code</th>
              <th className="py-3 px-4 text-right font-semibold">Qty</th>
              <th className="py-3 px-4 text-right font-semibold">Unit Price</th>
              <th className="py-3 px-4 text-right font-semibold">Taxable Value</th>
              <th className="py-3 px-4 text-right font-semibold">VAT Rate</th>
              <th className="py-3 px-4 text-right font-semibold">VAT Amount</th>
              <th className="py-3 px-4 text-right font-semibold">Total Price</th>
            </tr>
          </thead>
          <tbody className="divide-y border-b">
            {items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className="py-3 px-4">{idx + 1}</td>
                <td className="py-3 px-4">{item.description}</td>
                <td className="py-3 px-4 text-center">{item.hs_code}</td>
                <td className="py-3 px-4 text-right">{item.quantity}</td>
                <td className="py-3 px-4 text-right">{Number(item.unit_price).toFixed(2)}</td>
                <td className="py-3 px-4 text-right">{Number(item.taxable_value).toFixed(2)}</td>
                <td className="py-3 px-4 text-right">{item.vat_rate}%</td>
                <td className="py-3 px-4 text-right">{Number(item.vat_amount).toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-medium">{Number(item.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-16">
          <div className="w-72 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Taxable Value:</span>
              <span className="font-semibold">৳{Number(summary.total_taxable_value).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total VAT:</span>
              <span className="font-semibold">৳{Number(summary.total_vat_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <span>Grand Total:</span>
              <span>৳{Number(summary.grand_total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-center text-sm pt-8">
          <div>
            <div className="mx-auto w-48 border-t border-slate-800 pt-2">
              Authorized Signature (Seller)
            </div>
          </div>
          <div>
            <div className="mx-auto w-48 border-t border-slate-800 pt-2">
              Authorized Signature (Buyer)
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #mushak-print, #mushak-print * { visibility: visible; }
          #mushak-print { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  )
}
