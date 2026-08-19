'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createTransaction } from '@/domains/transactions/actions'

interface ParsedTransaction {
  type: 'sale' | 'expense' | 'payment_in' | 'payment_out'
  amount: number
  party_name: string | null
  description: string
}

export function VoiceAccountingFab() {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [parsedTx, setParsedTx] = useState<ParsedTransaction | null>(null)
  
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.lang = 'bn-BD'
      recognitionRef.current.interimResults = false
      recognitionRef.current.maxAlternatives = 1

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript
        setIsListening(false)
        await processVoiceCommand(transcript)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error)
        setIsListening(false)
        setIsProcessing(false)
        if (event.error !== 'no-speech') {
          toast.error('ভয়েস রেকর্ড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।')
        }
      }
      
      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [])

  const startListening = () => {
    if (!recognitionRef.current) {
      toast.error('আপনার ব্রাউজার ভয়েস রেকর্ডিং সাপোর্ট করে না।')
      return
    }
    
    try {
      setIsListening(true)
      recognitionRef.current.start()
    } catch (e) {
      console.error(e)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const processVoiceCommand = async (text: string) => {
    setIsProcessing(true)
    toast.info(`আপনার কথা: "${text}"`)
    
    try {
      const res = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        body: JSON.stringify({ text }),
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!res.ok) throw new Error('API Error')
      
      const data = await res.json()
      setParsedTx(data)
    } catch (error) {
      toast.error('ট্রানজেকশন বুঝতে সমস্যা হয়েছে।')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    if (!parsedTx) return
    
    try {
      setIsProcessing(true)
      const res = await createTransaction({
        type: parsedTx.type,
        amount: parsedTx.amount,
        new_party_name: parsedTx.party_name || undefined,
        notes: parsedTx.description,
        idempotencyKey: crypto.randomUUID()
      })
      
      if (res.success) {
        toast.success('সফলভাবে রেকর্ড করা হয়েছে!')
        setParsedTx(null)
      } else {
        toast.error(res.error || 'রেকর্ড করতে ব্যর্থ হয়েছে।')
      }
    } catch (e) {
      toast.error('সার্ভার সমস্যা।')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing && !isListening}
        className={`fixed bottom-[140px] right-6 md:bottom-28 md:right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-40
          ${isListening ? 'bg-red-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'} 
          ${isProcessing && !isListening ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isProcessing && !isListening ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : isListening ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Confirmation Modal overlay (simple absolute centered box for now) */}
      {parsedTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4">ট্রানজেকশন নিশ্চিত করুন</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">ধরন:</span>
                <span className="font-medium text-emerald-700">
                  {parsedTx.type === 'sale' && 'বিক্রি (Sale)'}
                  {parsedTx.type === 'expense' && 'খরচ (Expense)'}
                  {parsedTx.type === 'payment_in' && 'টাকা প্রাপ্তি (Payment In)'}
                  {parsedTx.type === 'payment_out' && 'টাকা প্রদান (Payment Out)'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">পরিমাণ:</span>
                <span className="font-bold text-lg">৳{parsedTx.amount}</span>
              </div>
              {parsedTx.party_name && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">পার্টি:</span>
                  <span className="font-medium">{parsedTx.party_name}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setParsedTx(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
                disabled={isProcessing}
              >
                বাতিল
              </button>
              <button 
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex justify-center items-center gap-2"
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                নিশ্চিত
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
