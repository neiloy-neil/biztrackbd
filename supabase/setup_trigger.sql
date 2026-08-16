-- Trigger to create business and default wallets on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_business_id uuid;
begin
  -- 1. Create a default business for the user
  insert into public.businesses (owner_id, name)
  values (new.id, 'My Business')
  returning id into new_business_id;

  -- 2. Create the 4 default wallets
  insert into public.wallets (business_id, type, balance)
  values 
    (new_business_id, 'cash', 0),
    (new_business_id, 'bkash', 0),
    (new_business_id, 'nagad', 0),
    (new_business_id, 'bank', 0);

  return new;
end;
$$ language plpgsql security definer;

-- Bind the trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
