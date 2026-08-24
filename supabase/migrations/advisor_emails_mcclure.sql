-- Add Jennifer McClure as an advisor; keep Erin Ridout allowlisted.
insert into private.advisor_emails (email)
values
  ('emridout@olemiss.edu'),
  ('mcclure@olemiss.edu')
on conflict (email) do nothing;

update public.profiles p
set role = 'advisor'
from private.advisor_emails a
where p.email = a.email
  and a.email in ('emridout@olemiss.edu', 'mcclure@olemiss.edu')
  and p.role <> 'advisor';
