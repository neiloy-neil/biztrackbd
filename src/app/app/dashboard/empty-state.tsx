import Link from 'next/link'
import { Plus, Package, Users, Receipt } from 'lucide-react'

export function DashboardEmptyState() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to BizTrack! 🚀</h2>
        <p className="text-slate-600 max-w-2xl mb-6">
          Your dashboard is currently empty. To start seeing beautiful charts and insights, let's set up your business in a few simple steps.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/app/inventory" className="group bg-white p-4 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-indigo-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-600 transition-colors">
              <Package className="h-5 w-5 text-indigo-600 group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">1. Add Products</h3>
            <p className="text-xs text-slate-500">Create your inventory items.</p>
          </Link>
          
          <Link href="/app/parties" className="group bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-600 transition-colors">
              <Users className="h-5 w-5 text-blue-600 group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">2. Add Customers</h3>
            <p className="text-xs text-slate-500">Add suppliers or customers.</p>
          </Link>

          <Link href="/app/pos" className="group bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-emerald-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-600 transition-colors">
              <Receipt className="h-5 w-5 text-emerald-600 group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">3. First Sale</h3>
            <p className="text-xs text-slate-500">Record your first transaction.</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
