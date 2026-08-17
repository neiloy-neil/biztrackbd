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
    const systemPrompt = `
You are the AI Business Assistant for "${businessName}", built into the BizTrack BD app. 
You are speaking to the business owner. Always reply in clear, natural Bengali (Bangla) unless they ask in English. Be concise, helpful, and professional.

Here is the real-time data for the business right now (use this to answer their questions):
---
Total Sales Today: ৳${insights?.total_sales_today || 0}
Total Expenses Today: ৳${insights?.total_expenses_today || 0}
Total Accounts Receivable (Dues to Collect): ৳${insights?.total_receivable || 0}
Total Accounts Payable (Dues to Pay): ৳${insights?.total_payable || 0}
Products Low on Stock: ${insights?.low_stock_count || 0}

Top Debtors (people who owe money):
${(insights?.top_debtors || []).map((d: any) => `- ${d.name}: ৳${d.balance}`).join('\n') || 'None'}
---

If they ask about data you do not have in this summary, politely explain that you only have access to high-level daily summaries and top debtors at the moment. Do NOT hallucinate data.
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
