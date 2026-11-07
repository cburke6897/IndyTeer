-- Published opportunities are readable without authentication. Their RLS also
-- evaluates this read-only predicate; anonymous callers need execute permission.
grant execute on function public.is_org_member(uuid) to anon;
