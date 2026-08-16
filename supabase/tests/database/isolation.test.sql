BEGIN;

SELECT plan(8);

-- Create mock users for testing
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');

SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
INSERT INTO auth.users (id) VALUES ('22222222-2222-2222-2222-222222222222');

-- Test 1: User 1 creates a business
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
INSERT INTO public.businesses (id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Business A');
SELECT results_eq(
    'SELECT name FROM public.businesses',
    ARRAY['Business A'],
    'User 1 can see their own business'
);

-- Test 2: User 2 creates a business
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);
INSERT INTO public.businesses (id, name) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Business B');

-- Test 3: Tenant Isolation (User 2 should NOT see Business A)
SELECT results_eq(
    'SELECT name FROM public.businesses',
    ARRAY['Business B'],
    'User 2 cannot see User 1''s business'
);

-- Test 4: Financial Integrity - Check constraint on transaction amount
SELECT throws_ok(
    'INSERT INTO public.transactions (business_id, branch_id, type, total_amount) VALUES (''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', (SELECT id FROM public.branches WHERE business_id = ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'' LIMIT 1), ''sale'', -500.00)',
    'new row for relation "transactions" violates check constraint "transactions_total_amount_check"',
    'Transactions cannot have negative total amounts'
);

-- Test 5: Tenant Isolation on Branches
SELECT results_eq(
    'SELECT name FROM public.branches',
    ARRAY['Main Branch'],
    'User 2 only sees their default branch'
);

-- Test 6: Tenant Isolation on insert (User 2 cannot insert a branch for Business A)
SELECT throws_ok(
    'INSERT INTO public.branches (business_id, name) VALUES (''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''Hack Branch'')',
    'new row violates row-level security policy for table "branches"',
    'User 2 cannot insert data into User 1''s business'
);

-- Clean up
ROLLBACK;
