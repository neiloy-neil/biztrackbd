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

    // Fetch live context in parallel (3s timeout — don't block the stream)
    const timeout = <T>(p: Promise<T>) => Promise.race([p, new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), 3000)) as Promise<any>])
    const [{ data: summary }, { data: insights }] = await Promise.all([
      timeout(supabase.rpc('get_dashboard_summary', { p_business_id: businessId })),
      timeout(supabase.rpc('get_actionable_insights', { p_business_id: businessId })),
    ])

    // Construct the System Prompt with the live data
    const topDebtors = (insights?.top_debtors || []) as Array<{ name: string; phone?: string; current_due: number }>
    const lowStock = (insights?.low_stock || []) as Array<{ name: string; current_stock: number; min_stock: number }>
    const topSelling = (insights?.top_selling || []) as Array<{ name: string; total_sold: number }>

    const systemPrompt = `
You are the AI Business Assistant for "${businessName}", built into the BizTrack BD app.
You are speaking to the business owner. Always reply in clear, natural Bengali (Bangla) unless they ask in English. Be concise, helpful, and professional.

Here is the real-time data for the business right now (use this to answer their questions):
---
Today's Financial Summary:
- মোট বিক্রয় (Total Sales): ৳${summary?.total_sales ?? 0}
- মোট আয় (Total Income): ৳${summary?.total_income ?? 0}
- পণ্যের ক্রয়মূল্য (COGS): ৳${summary?.total_cogs ?? 0}
- গ্রস প্রফিট (Gross Profit): ৳${summary?.gross_profit ?? 0}
- মোট খরচ (Total Expenses): ৳${summary?.total_expenses ?? 0}
- নেট প্রফিট (Net Profit): ৳${summary?.net_profit ?? 0}
- হাতে টাকা (Available Money): ৳${summary?.available_money ?? 0}
- কাস্টমার বাকি (Customer Due): ৳${summary?.customer_due ?? 0}
- সাপ্লায়ার বাকি (Supplier Due): ৳${summary?.supplier_due ?? 0}

Top Debtors (customers who owe the most):
${topDebtors.length > 0 ? topDebtors.map(d => `- ${d.name}: ৳${d.current_due}`).join('\n') : 'কোনো বাকি নেই'}

Low Stock Products:
${lowStock.length > 0 ? lowStock.map(p => `- ${p.name}: ${p.current_stock} remaining (min: ${p.min_stock})`).join('\n') : 'কোনো কম স্টক পণ্য নেই'}

Top Selling Products (last 30 days):
${topSelling.length > 0 ? topSelling.map(p => `- ${p.name}: ${p.total_sold} sold`).join('\n') : 'কোনো ডেটা নেই'}
---

Answer questions using only the data above. Do NOT hallucinate numbers. If something is not in the data, say so clearly.
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
