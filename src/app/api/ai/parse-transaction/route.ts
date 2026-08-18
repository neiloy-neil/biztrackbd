import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { text }: { text: string } = await req.json()
    
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { object } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: `You are an expert at parsing Bengali text into structured accounting transactions.
The user is speaking a voice command like "রহিমকে ২০০ টাকা দিলাম" (Gave Rahim 200 taka) or "সাকিবের কাছ থেকে ৫০০০ টাকা পেলাম" (Received 5000 from Shakib).
Extract the party name, the amount, and determine the transaction type (RECEIPT for getting money/sales, PAYMENT for giving money/expenses).
If it's a sale without a name, party_name can be "Cash Sale" or null.`,
      prompt: `Parse this transaction text: "${text}"`,
      schema: z.object({
        type: z.enum(['sale', 'expense', 'payment_in', 'payment_out']).describe('sale=product sold, expense=business cost, payment_in=received due from customer, payment_out=paid due to supplier/person'),
        amount: z.number().describe('The transaction amount as a number'),
        party_name: z.string().nullable().describe('The name of the person or business (e.g. "রহিম", "সাকিব"). Null if not mentioned.'),
        description: z.string().describe('A short summary of what happened, in Bengali.')
      }),
      temperature: 0.1,
    })

    // If there is a party name, we could theoretically search the DB for their ID, 
    // but for the UI, returning the name to confirm is best.

    return NextResponse.json(object)
    
  } catch (error: any) {
    console.error('AI Parse Error:', error)
    return new NextResponse(error.message || 'Something went wrong', { status: 500 })
  }
}
