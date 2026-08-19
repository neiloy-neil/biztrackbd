'use server'

import { createClient } from '@/lib/supabase/server'
import { authAction } from '@/lib/actions/safe-action'

export const getMushak63Report = authAction(async (data: { invoiceId: string }, ctx) => {
  const supabase = await createClient()

  // 1. Get invoice and transaction details
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select(`
      *,
      transactions!inner (
        id, party_id, business_id, branch_id, transaction_date
      )
    `)
    .eq('id', data.invoiceId)
    .single()

  if (invErr || !invoice) throw new Error('Invoice not found')

  // Verify business scope
  if (invoice.transactions.business_id !== ctx.businessId) {
    throw new Error('Unauthorized')
  }

  // 2. Get Business Tax Profile
  const { data: taxProfile } = await supabase
    .from('business_tax_profiles')
    .select('*')
    .eq('business_id', ctx.businessId)
    .maybeSingle()

  if (!taxProfile?.vat_enabled) {
    throw new Error('VAT is not enabled for this business')
  }

  // 3. Get Customer Tax Profile
  let customerTaxInfo = null
  if (invoice.transactions.party_id) {
    const { data: party } = await supabase
      .from('parties')
      .select('name, address, tax_meta')
      .eq('id', invoice.transactions.party_id)
      .single()
    if (party) {
      customerTaxInfo = {
        name: party.name,
        address: party.address,
        tin: party.tax_meta?.tin,
        bin: party.tax_meta?.bin
      }
    }
  }

  // 4. Get Invoice Items with Product HS Code
  const { data: items } = await supabase
    .from('invoice_items')
    .select(`
      *,
      products ( name, tax_meta )
    `)
    .eq('invoice_id', data.invoiceId)

  const formattedItems = (items || []).map((it: any) => ({
    description: it.products?.name,
    hs_code: it.products?.tax_meta?.hs_code || 'N/A',
    quantity: it.quantity,
    unit_price: it.unit_price,
    total_price: it.total_price,
    taxable_value: it.taxable_value,
    vat_rate: it.vat_rate,
    vat_amount: it.vat_amount
  }))

  return {
    success: true,
    data: {
      mushak_reference: invoice.mushak_reference || 'Mushak-6.3',
      tax_invoice_number: invoice.tax_invoice_number,
      issue_date: invoice.transactions.transaction_date,
      business_info: {
        tin: taxProfile.tin,
        bin: taxProfile.bin
      },
      customer_info: customerTaxInfo,
      pricing_model: invoice.pricing_model_applied,
      items: formattedItems,
      summary: {
        total_taxable_value: invoice.total_taxable_value,
        total_vat_amount: invoice.total_vat_amount,
        grand_total: invoice.total_amount
      }
    }
  }
})
