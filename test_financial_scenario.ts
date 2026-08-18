import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function run() {
  console.log('--- APPLYING SQL MIGRATION ---')
  const sqlContent = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20270101000001_financial_p0_p1_fixes.sql'), 'utf8')
  // Split statements manually since pg meta isn't available easily here, 
  // actually Supabase service role can run raw sql via a specific method or we can just try to run it via REST if supported, but typically we can't run raw DDL via supabase-js without an RPC.
  // Oh wait, supabase-js `supabase.rpc` cannot execute raw DDL text!
  // I must run it using postgres client.
  console.log('Skipping JS DDL, assuming migration applied via other means or we will inject an RPC to run SQL.')
  
  console.log('--- STARTING FINANCIAL VALIDATION SCENARIO ---')
  
  // 1. Setup Test Business
  const { data: business } = await supabase
    .from('businesses')
    .insert({ name: 'Test Financial Business' })
    .select('id')
    .single()
    
  const bizId = business!.id
  console.log(`Created business: ${bizId}`)
  
  // Create branches and accounts manually since triggers might not be perfect for tests
  const { data: branch } = await supabase.from('branches').insert({ business_id: bizId, name: 'Main' }).select('id').single()
  const branchId = branch!.id

  const { data: cashAcc } = await supabase.from('accounts').insert({ business_id: bizId, name: 'Cash', type: 'cash' }).select('id').single()
  const { data: bkashAcc } = await supabase.from('accounts').insert({ business_id: bizId, name: 'bKash', type: 'mobile_money' }).select('id').single()
  
  const cashId = cashAcc!.id
  const bkashId = bkashAcc!.id

  // Create Parties
  const { data: customer } = await supabase.from('parties').insert({ business_id: bizId, name: 'Rahim', type: 'customer' }).select('id').single()
  const { data: supplier } = await supabase.from('parties').insert({ business_id: bizId, name: 'Karim', type: 'supplier' }).select('id').single()
  
  const cusId = customer!.id
  const supId = supplier!.id

  // Create Product
  const { data: product } = await supabase.from('products').insert({
    business_id: bizId, name: 'Product A', cost: 600, price: 1000
  }).select('id').single()
  const prodId = product!.id

  // Helper to dump state
  async function dumpState(step: string) {
    const { data: pCustomer } = await supabase.from('v_party_balances').select('current_due').eq('id', cusId).single()
    const { data: pSupplier } = await supabase.from('v_party_balances').select('current_due').eq('id', supId).single()
    const { data: daily } = await supabase.rpc('get_daily_closing_summary', { p_business_id: bizId, p_date: new Date().toISOString().split('T')[0] })
    
    console.log(`\n[${step}] STATE:`)
    console.log(`Cash: ${daily?.expected_cash} | bKash: ${daily?.balances?.bkash}`)
    console.log(`Customer Due: ${pCustomer?.current_due} | Supplier Due: ${pSupplier?.current_due}`)
    console.log(`Total Profit: ${daily?.total_profit}`)
  }

  // 1. Opening Cash 50,000
  await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'opening_balance',
    p_total_amount: 50000, p_account_id: cashId
  })
  await dumpState('1. Opening Cash 50k')

  // 2. Purchase 10 units (Total 6000, Paid 2000)
  const { data: purchTxnId } = await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'purchase',
    p_total_amount: 6000, p_account_id: cashId, p_party_id: supId
  })
  // Wait, the atomic one doesn't allow setting partial payment easily. 
  // It inserts -6000 into cash. We need to fix that manually for the simulation to match partial payment.
  // Actually, POS allows partial payments because it builds items manually. Let's do it manually.
  await supabase.from('account_transactions').update({ amount: -2000 }).eq('transaction_id', purchTxnId)
  await supabase.from('transaction_items').insert({ transaction_id: purchTxnId, product_id: prodId, quantity: 10, unit_price: 600, subtotal: 6000 })
  await supabase.from('inventory_movements').insert({ business_id: bizId, branch_id: branchId, product_id: prodId, transaction_id: purchTxnId, type: 'in', quantity: 10 })
  await dumpState('2. Purchase 10 units')

  // 3. Sell 5 units (Total 5000, Paid 2000)
  const { data: saleTxId, error: saleErr1 } = await supabase.rpc('process_pos_sale', {
    p_business_id: bizId, p_branch_id: branchId, p_party_id: cusId,
    p_discount: 0, p_notes: '', p_user_id: null,
    p_items: [{ product_id: prodId, quantity: 5 }],
    p_payments: [{ account_id: cashId, amount: 2000 }]
  })
  if (saleErr1) throw saleErr1;
  await dumpState('3. Sell 5 units')

  // 4. Receive 1000 from Rahim
  await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'payment_in',
    p_total_amount: 1000, p_account_id: cashId, p_party_id: cusId
  })
  await dumpState('4. Receive 1000 from Rahim')

  // 5. Add business income 2000
  await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'income',
    p_total_amount: 2000, p_account_id: cashId
  })
  await dumpState('5. Add income 2000')

  // 6. Add expense 800
  await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'expense',
    p_total_amount: 800, p_account_id: cashId
  })
  await dumpState('6. Add expense 800')

  // 7. Pay Karim 1500
  await supabase.rpc('create_transaction_atomic', {
    p_business_id: bizId, p_branch_id: branchId, p_type: 'payment_out',
    p_total_amount: 1500, p_account_id: cashId, p_party_id: supId
  })
  await dumpState('7. Pay Karim 1500')

  // 8. Transfer 5000 (Cash -> bKash)
  await supabase.rpc('create_transfer_atomic', {
    p_business_id: bizId, p_branch_id: branchId,
    p_amount: 5000, p_from_account_id: cashId, p_to_account_id: bkashId
  })
  await dumpState('8. Transfer 5000 Cash -> bKash')

  // 9. Sell 2 units (Paid full 2000)
  const { error: saleErr2 } = await supabase.rpc('process_pos_sale', {
    p_business_id: bizId, p_branch_id: branchId, p_party_id: cusId,
    p_discount: 0, p_notes: '', p_user_id: null,
    p_items: [{ product_id: prodId, quantity: 2 }],
    p_payments: [{ account_id: cashId, amount: 2000 }]
  })
  if (saleErr2) throw saleErr2;
  await dumpState('9. Sell 2 units')

  console.log('--- DONE ---')
}

run().catch(console.error)
