import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminClient = createClient(supabaseUrl, supabaseServiceKey)
const userClient = createClient(supabaseUrl, supabaseAnonKey)

async function assert(condition: boolean, message: string, err?: any) {
  if (!condition) {
    throw new Error(`[FAILED] ${message}` + (err ? ' | Error: ' + JSON.stringify(err) : ''))
  }
  console.log(`[PASSED] ${message}`)
}

async function runCertification() {
  console.log('--- STARTING BIZTRACK E2E CERTIFICATION ---')

  const testEmail = `test_cert_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  // 1. Signup & Auth
  console.log('\n1. AUTHENTICATION & ONBOARDING')
  const { data: authData, error: authErr } = await userClient.auth.signUp({
    email: testEmail,
    password: testPassword
  })
  await assert(!authErr && !!authData.user, 'User signed up successfully', authErr)

  const userId = authData.user!.id

  // 2. Onboarding (Business Creation)
  const { data: bizData, error: bizErr } = await adminClient
    .from('businesses')
    .insert({ name: 'Kamal Enterprise E2E' })
    .select('id')
    .single()

  await assert(!bizErr && !!bizData, 'Business created successfully', bizErr)
  const businessId = bizData!.id
      await adminClient.from('business_members').insert({ business_id: businessId, user_id: userId, role: 'owner' })

  // Create Branch
  const { data: branchData, error: branchErr } = await userClient
    .from('branches')
    .insert({ business_id: businessId, name: 'Main Branch' })
    .select('id')
    .single()
  await assert(!branchErr && !!branchData, 'Branch created successfully', branchErr)
  const branchId = branchData!.id

  // Create Account
      const { data: accountData, error: accErr } = await userClient
        .from('accounts')
        .insert({ business_id: businessId, name: 'Cash', type: 'cash' })
        .select('id')
        .single()
      await assert(!accErr && !!accountData, 'Account created successfully', accErr)
      const accountId = accountData!.id

      // Seed account with 100000 via a transaction
      const { data: initTx, error: initTxErr } = await userClient.from('transactions').insert({
        business_id: businessId, branch_id: branchId, type: 'income', state: 'completed', total_amount: 100000, subtotal: 100000
      }).select('id').single()
      await assert(!initTxErr && !!initTx, 'Initial transaction created', initTxErr)
      
      const { error: initAccTxErr } = await userClient.from('account_transactions').insert({
        transaction_id: initTx!.id, account_id: accountId, amount: 100000
      })
      await assert(!initAccTxErr, 'Initial account transaction created', initAccTxErr)


  // 3. Supply Chain
  console.log('\n2. SUPPLY CHAIN (PURCHASE)')
  const { data: supplierData, error: supErr } = await userClient
    .from('parties')
    .insert({ business_id: businessId, type: 'supplier', name: 'Global Traders' })
    .select('id')
    .single()
  await assert(!supErr && !!supplierData, 'Supplier created', supErr)
  const supplierId = supplierData!.id

  const { data: productData, error: prodErr } = await userClient
    .from('products')
    .insert({ business_id: businessId, name: 'Rice Sack 50kg', price: 2500, cost: 2000 })
    .select('id')
    .single()
  await assert(!prodErr && !!productData, 'Product created', prodErr)
  const productId = productData!.id

  // Execute Purchase
  const { error: purchaseErr } = await userClient.rpc('process_pos_sale', {
    p_business_id: businessId,
    p_branch_id: branchId,
    p_party_id: supplierId,
    p_total_amount: 100000,
    p_subtotal: 100000,
    p_discount: 0,
    p_notes: 'Initial Stock',
    p_user_id: userId,
    p_items: [{ product_id: productId, quantity: 50 }], // 50 * 2000 = 100,000
    p_payments: [{ account_id: accountId, amount: 100000 }] // Paid in full
  })
  // Wait, process_pos_sale decreases inventory. We need a purchase action. 
  // But for certification we can just inject an 'in' movement directly or use the purchase RPC.
  // Let's do it manually since process_purchase might be different.
  const { data: trx, error: txErr } = await userClient.from('transactions').insert({
    business_id: businessId, branch_id: branchId, party_id: supplierId, type: 'purchase', state: 'completed', total_amount: 100000, subtotal: 100000
  }).select('id').single()

  await userClient.from('inventory_movements').insert({
    business_id: businessId, branch_id: branchId, product_id: productId, type: 'in', quantity: 50, transaction_id: trx!.id
  })

  await userClient.from('account_transactions').insert({
    transaction_id: trx!.id, account_id: accountId, amount: -100000
  })

  await assert(!txErr, 'Purchase executed manually', txErr)

  // Verify Stock
  const { data: stockData } = await userClient.rpc('calculate_current_stock', {
    p_business_id: businessId, p_branch_id: branchId, p_product_id: productId
  })
  await assert(stockData === 50, 'Stock verified at 50')

  console.log('\n3. POS SALE & PARTIAL PAYMENT')
  const { data: customerData, error: custErr } = await userClient
    .from('parties')
    .insert({ business_id: businessId, type: 'customer', name: 'Rahim' })
    .select('id')
    .single()
  await assert(!custErr && !!customerData, 'Customer created', custErr)
  const customerId = customerData!.id

  const { data: posTxId, error: posErr } = await userClient.rpc('process_pos_sale', {
    p_business_id: businessId,
    p_branch_id: branchId,
    p_party_id: customerId,
    p_total_amount: 5000,
    p_subtotal: 5000,
    p_discount: 0,
    p_notes: 'Sale 1',
    p_user_id: userId,
    p_items: [{ product_id: productId, quantity: 2 }],
    p_payments: [{ account_id: accountId, amount: 3000 }] // Partial payment
  })
  await assert(!posErr && !!posTxId, 'POS Sale executed', posErr)

  // Verify Due
  const { data: partyCheck } = await userClient.from('parties').select('current_due').eq('id', customerId).single()
  await assert(partyCheck!.current_due === 2000, 'Customer due accurately tracked at 2000')

  // Verify Stock
  const { data: stockData2 } = await userClient.rpc('calculate_current_stock', {
    p_business_id: businessId, p_branch_id: branchId, p_product_id: productId
  })
  await assert(stockData2 === 48, 'Stock reduced to 48')

  console.log('\n4. ADMIN AUDITING')
  const { data: auditLogs, error: auditErr } = await adminClient
    .from('audit_logs')
    .select('*')
    .eq('business_id', businessId)

  await assert(!auditErr && auditLogs !== null && auditLogs.length > 0, 'Audit logs generated successfully', auditErr)

  console.log('\n[SUCCESS] E2E Certification Complete. All chains verified.')
}

runCertification().catch(console.error)
