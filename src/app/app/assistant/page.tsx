import { Metadata } from 'next'
import { AiAssistant } from '@/domains/ai/components/AiAssistant'

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Chat with BizTrack BD AI',
}

export default function AiAssistantPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-20 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">AI Assistant</h2>
          <p className="text-slate-500 mt-2">
            Ask questions about your business in Bengali or English.
          </p>
        </div>
      </div>
      
      <AiAssistant />
    </div>
  )
}
