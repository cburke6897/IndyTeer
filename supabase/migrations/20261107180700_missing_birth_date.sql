-- Legacy profiles may be onboarded without a birth date. Let the signed-in
-- user supply the missing value without reopening completed onboarding.
create or replace function public.set_missing_birth_date(p_date date)
returns public.users language plpgsql security definer set search_path='' as $$
declare v_user public.users%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in to update your date of birth.'; end if;
 if p_date is null or p_date>current_date or p_date<current_date-interval '120 years' then raise exception 'Enter a valid date of birth.'; end if;
 select * into v_user from public.users where id=auth.uid() for update;
 if not found then raise exception 'User profile not found.'; end if;
 if v_user.date_of_birth is not null then raise exception 'Your date of birth is already recorded.'; end if;
 update public.users set date_of_birth=p_date where id=auth.uid() returning * into v_user;
 return v_user;
end;
$$;
revoke all on function public.set_missing_birth_date(date) from public,anon;
grant execute on function public.set_missing_birth_date(date) to authenticated;
