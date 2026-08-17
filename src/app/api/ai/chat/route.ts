import { streamText, convertToModelMessages } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Get active business
    const { data: member } = await supabase
      .from('business_members')
      .select('business_id, businesses(name)')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!member) {
      return new NextResponse('No active business found', { status: 400 })
    }

    const businessId = member.business_id
    const businessName = (member.businesses as any)?.name || 'Your Business'

    // Fetch live context (3s timeout — don't block the stream if DB is slow)
    const insightsPromise = supabase.rpc('get_actionable_insights', { p_business_id: businessId })
    const timeoutPromise = new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000))
    const { data: insights } = await Promise.race([insightsPromise, timeoutPromise])

    // Construct the System Prompt with the live data
    const topDebtors = (insights?.top_debtors || []) as Array<{ name: string; phone?: string; current_due: number }>
    const lowStock = (insights?.low_stock || []) as Array<{ name: string; current_stock: number; min_stock: number }>
    const topSelling = (insights?.top_selling || []) as Array<{ name: string; total_sold: number }>

    const systemPrompt = `
You are the AI Business Assistant for "${businessName}", built into the BizTrack BD app.
You are speaking to the business owner. Always reply in clear, natural Bengali (Bangla) unless they ask in English. Be concise, helpful, and professional.

Here is the real-time data for the business right now (use this to answer their questions):
---
Top Debtors (customers who owe money, sorted by amount):
${topDebtors.length > 0 ? topDebtors.map(d => `- ${d.name}: ৳${d.current_due}`).join('\n') : 'কোনো বাকি নেই'}

Low Stock Products:
${lowStock.length > 0 ? lowStock.map(p => `- ${p.name}: ${p.current_stock} (min: ${p.min_stock})`).join('\n') : 'কোনো কম স্টক পণ্য নেই'}

Top Selling Products (last 30 days):
${topSelling.length > 0 ? topSelling.map(p => `- ${p.name}: ${p.total_sold} sold`).join('\n') : 'কোনো ডেটা নেই'}
---

If they ask about data you do not have here (e.g. today's exact sales total, expenses breakdown), politely explain that you only have access to the above data at the moment. Do NOT hallucinate numbers.
    `.trim()

    const result = streamText({
      model: google('gemini-3.6-flash'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      temperature: 0.2, // Keep it grounded
    })

    return result.toTextStreamResponse()
    
  } catch (error: any) {
    console.error('AI Chat Error:', error)
    return new NextResponse(error.message || 'Something went wrong', { status: 500 })
  }
}
