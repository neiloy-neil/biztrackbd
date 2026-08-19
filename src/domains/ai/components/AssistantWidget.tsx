'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AiAssistant } from './AiAssistant'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export function AssistantWidget() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger 
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 rounded-full shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white z-50 flex items-center justify-center p-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Sparkles className="w-6 h-6" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l-0 sm:border-l bg-slate-50 flex flex-col h-full z-[100]">
        <SheetHeader className="p-4 border-b bg-white text-left hidden">
          <SheetTitle>AI Assistant</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden h-full">
          {/* We wrap AiAssistant in a slightly modified layout to fit the sheet nicely */}
          <AiAssistant inWidget />
        </div>
      </SheetContent>
    </Sheet>
  )
}
