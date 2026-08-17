'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Sparkles, User } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function AiAssistant() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ url: '/api/ai/chat' }),
  })
  const isLoading = status === 'submitted' || status === 'streaming'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[600px] max-w-2xl mx-auto w-full border rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-emerald-50/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">BizTrack AI</h2>
          <p className="text-xs text-slate-500">Always ready to help with your business</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-500 p-8">
            <Sparkles className="w-12 h-12 text-slate-300" />
            <p>আপনার ব্যবসায়ের যেকোনো তথ্য জানতে আমাকে বাংলায় প্রশ্ন করতে পারেন।</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setInput('আজকের সেলস কত?')}>
                আজকের সেলস কত?
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInput('সবচেয়ে বেশি বাকি কার?')}>
                সবচেয়ে বেশি বাকি কার?
              </Button>
            </div>
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div 
                className={`px-4 py-3 rounded-2xl max-w-[85%] whitespace-pre-wrap ${
                  m.role === 'user' 
                    ? 'bg-emerald-600 text-white rounded-tr-sm' 
                    : 'bg-white border text-slate-700 rounded-tl-sm shadow-sm'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white border text-slate-700 rounded-tl-sm shadow-sm flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce delay-75" />
              <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            if (!input.trim() || isLoading) return
            sendMessage({ role: 'user', content: input } as any)
            setInput('')
          }} 
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="আপনার প্রশ্ন লিখুন..."
            className="flex-1 rounded-full h-12 px-6 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            size="icon" 
            className="h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700 shrink-0 shadow-md"
          >
            <Send className="w-5 h-5 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  )
}
