'use client'

import { useEffect, useState } from 'react'
import { getTransactionAudit } from '../actions'

export function TransactionAudit({ transactionId }: { transactionId: string }) {
  const [audit, setAudit] = useState<{ created_by: string; updated_by: string | null; reversed_by: string | null } | null>(null)
  
  useEffect(() => {
    getTransactionAudit({ id: transactionId }).then(res => {
      if (res.success && res.data) {
        setAudit(res.data)
      }
    })
  }, [transactionId])

  if (!audit) return null

  return (
    <div className="text-[10px] text-slate-400 flex gap-2 mt-1">
      {audit.created_by && <span>Created: {audit.created_by}</span>}
      {audit.updated_by && <span>• Updated: {audit.updated_by}</span>}
      {audit.reversed_by && <span>• Reversed: {audit.reversed_by}</span>}
    </div>
  )
}
