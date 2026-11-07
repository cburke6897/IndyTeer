-- Preserve the name originally collected by the early Auth and Media implementation.
update public.users u set full_name=coalesce(
  nullif(a.raw_user_meta_data->>'full_name',''),
  nullif(a.raw_user_meta_data->>'name',''),
  nullif(a.raw_user_meta_data->>'display_name',''))
from auth.users a where a.id=u.id and trim(u.full_name)=''
  and coalesce(nullif(a.raw_user_meta_data->>'full_name',''),
    nullif(a.raw_user_meta_data->>'name',''),nullif(a.raw_user_meta_data->>'display_name','')) is not null;
