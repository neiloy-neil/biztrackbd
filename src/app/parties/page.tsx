import { Suspense } from 'react'
import { PartyList } from '@/domains/parties/components/PartyList'
import { getParties } from '@/domains/parties/actions'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function PartiesPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const type = resolvedParams?.type as 'customer' | 'supplier' | undefined
  const search = resolvedParams?.search as string | undefined

  const partiesRes = await getParties({ type, search })
  const parties = partiesRes?.success ? partiesRes.data : []

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">পার্টি সমূহ</h2>
        <Link href="/parties/new">
          <Button className="bg-[#007AFF] hover:bg-[#005bb5]">
            <Plus className="mr-2 h-4 w-4" /> নতুন পার্টি
          </Button>
        </Link>
      </div>

      <PartyList initialParties={parties || []} currentType={type || 'customer'} />
    </div>
  )
}
