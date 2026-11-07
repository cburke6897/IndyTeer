-- Volunteers may withdraw upcoming commitments, but cannot erase attended or
-- verified organization records through the cancellation action.
create or replace function public.cancel_registration(p_registration_id uuid)
returns public.registrations language plpgsql security definer set search_path='' as $$
declare v_row public.registrations%rowtype;v_opportunity public.opportunities%rowtype;
begin
 select * into v_row from public.registrations where id=p_registration_id;
 if not found or auth.uid() is null or v_row.user_id<>auth.uid() then raise exception 'Registration not found.'; end if;
 select * into v_opportunity from public.opportunities where id=v_row.opportunity_id for update;
 select * into v_row from public.registrations where id=p_registration_id for update;
 if v_row.status not in('pending','approved') then raise exception 'Registration cannot be cancelled.'; end if;
 if v_row.attended or v_row.hours_verified or v_opportunity.starts_at<=now()
 then raise exception 'This event has started or attendance is recorded. Contact the organization for corrections.'; end if;
 update public.registrations set status='cancelled',attended=false,hours_verified=false,hours=null,verified_at=null,cancelled_at=now()
 where id=p_registration_id returning * into v_row;
 return v_row;
end;
$$;
