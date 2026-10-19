-- Run once in your own Supabase project's SQL editor.
create table public.ledgers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.ledgers enable row level security;
create policy "Read own ledger" on public.ledgers for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own ledger" on public.ledgers for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own ledger" on public.ledgers for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.ledgers from anon;
grant select,insert,update on public.ledgers to authenticated;

-- Optimistic revision prevents one device from silently overwriting another.
create function public.save_ledger(ledger_data jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if expected_revision=0 then
  insert into public.ledgers(user_id,data) values(auth.uid(),ledger_data)
  on conflict do nothing returning revision into next_revision;
 else
  update public.ledgers set data=ledger_data,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=expected_revision returning revision into next_revision;
 end if;
 return next_revision;
end $$;
revoke all on function public.save_ledger(jsonb,bigint) from public,anon;
grant execute on function public.save_ledger(jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
 values('statements','statements',false,5000000);
create policy "Read own statements" on storage.objects for select to authenticated
 using(bucket_id='statements' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own statements" on storage.objects for insert to authenticated
 with check(bucket_id='statements' and (storage.foldername(name))[1]=(select auth.uid())::text);

