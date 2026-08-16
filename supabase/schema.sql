-- BizTrack BD Initial Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Businesses Table
create table public.businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Businesses
alter table public.businesses enable row level security;
create policy "Users can view their own businesses" on public.businesses for select using (auth.uid() = owner_id);
create policy "Users can insert their own businesses" on public.businesses for insert with check (auth.uid() = owner_id);
create policy "Users can update their own businesses" on public.businesses for update using (auth.uid() = owner_id);

-- 2. Wallets Table
create type public.wallet_type as enum ('cash', 'bkash', 'nagad', 'bank');

create table public.wallets (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  type public.wallet_type not null,
  balance numeric(12, 2) default 0.00 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(business_id, type)
);

-- RLS: Wallets
alter table public.wallets enable row level security;
create policy "Users can access wallets of their businesses" on public.wallets
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- 3. Parties Table (Customers & Suppliers)
create type public.party_type as enum ('customer', 'supplier');

create table public.parties (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  type public.party_type not null,
  name text not null,
  phone text,
  current_balance numeric(12, 2) default 0.00 not null, -- Positive means they owe us (পাওনা), Negative means we owe them (দেনা)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Parties
alter table public.parties enable row level security;
create policy "Users can access parties of their businesses" on public.parties
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- 4. Transactions Table
create type public.transaction_type as enum ('sale', 'expense', 'payment_in', 'payment_out');

create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  wallet_id uuid references public.wallets(id) not null,
  party_id uuid references public.parties(id), -- Optional, used for dues/payments
  type public.transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  notes text,
  transaction_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id) on delete set null
);

-- RLS: Transactions
alter table public.transactions enable row level security;
create policy "Users can access transactions of their businesses" on public.transactions
  for all using (
    business_id in (select id from public.businesses where owner_id = auth.uid())
  );

-- 5. DB Functions/Triggers for Data Integrity
-- Trigger to update Wallet Balance and Party Balance upon new transaction
create or replace function public.process_transaction()
returns trigger as $$
begin
  -- Update Wallet Balance
  if NEW.type = 'sale' or NEW.type = 'payment_in' then
    update public.wallets set balance = balance + NEW.amount where id = NEW.wallet_id;
  elsif NEW.type = 'expense' or NEW.type = 'payment_out' then
    update public.wallets set balance = balance - NEW.amount where id = NEW.wallet_id;
  end if;

  -- Update Party Balance if applicable
  if NEW.party_id is not null then
    if NEW.type = 'sale' then
      -- Customer owes more money
      update public.parties set current_balance = current_balance + NEW.amount where id = NEW.party_id;
    elsif NEW.type = 'payment_in' then
      -- Customer paid some dues
      update public.parties set current_balance = current_balance - NEW.amount where id = NEW.party_id;
    elsif NEW.type = 'expense' then
      -- We owe supplier more money (recorded as an expense linked to supplier)
      update public.parties set current_balance = current_balance - NEW.amount where id = NEW.party_id;
    elsif NEW.type = 'payment_out' then
      -- We paid supplier some dues
      update public.parties set current_balance = current_balance + NEW.amount where id = NEW.party_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_transaction_created
  after insert on public.transactions
  for each row execute function public.process_transaction();
