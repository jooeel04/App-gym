-- Aviso del fin del descanso como notificación push (del servidor).
--
-- En iPhone la web no puede vibrar y, con la app en segundo plano o la pantalla
-- bloqueada, el temporizador de la app se para. Así que, al empezar el descanso, la app
-- apunta aquí cuándo acaba y el servidor manda una notificación push a esa hora: el
-- sistema la hace sonar y vibrar aunque el móvil esté bloqueado.
--
-- rest_alerts             un aviso pendiente por persona (el último descanso)
-- dispatch_rest_alerts()  pg_cron cada 2 segundos: si hay avisos que ya tocan, llama a la app
-- take_rest_alerts()      la app recoge los que tocan (y los borra) para mandarlos
-- Se puede ejecutar más de una vez.

create table if not exists public.rest_alerts (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null,
  due_at     timestamptz not null,
  kind       text not null default 'end' check (kind in ('end', 'before')),
  before_s   smallint not null default 0 check (before_s between 0 and 60),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.rest_alerts enable row level security;
drop policy if exists "rest_alerts: propio" on public.rest_alerts;
create policy "rest_alerts: propio" on public.rest_alerts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Lo llama pg_cron cada 2 segundos. Casi siempre no hay nada que hacer (una consulta
-- rápida); solo si algún aviso ya toca se llama a la app, una vez por aviso.
create or replace function public.dispatch_rest_alerts()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  -- Avisos viejos (la app no los recogió): ya no sirven.
  delete from public.rest_alerts where due_at < now() - interval '2 minutes';
  update public.rest_alerts set claimed_at = now()
   where due_at <= now() and (claimed_at is null or claimed_at < now() - interval '20 seconds');
  if found then
    perform net.http_post(
      url := 'https://app-gym-swart.vercel.app/api/rest-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value from private.settings where key = 'reminder_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  end if;
end;
$$;

-- La app recoge los avisos que ya tocan (con las claves para mandarlos) y se borran.
create or replace function public.take_rest_alerts(p_secret text)
returns table (endpoint text, p256dh text, auth text, kind text, before_s smallint, vapid_private text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'reminder_secret') then
    raise exception 'forbidden';
  end if;
  return query
  with taken as (
    delete from public.rest_alerts a where a.due_at <= now() + interval '1 second'
    returning a.user_id, a.endpoint, a.kind, a.before_s
  )
  select t.endpoint, s.p256dh, s.auth, t.kind, t.before_s, (select value from private.settings where key = 'vapid_private')
  from taken t
  join public.push_subscriptions s on s.endpoint = t.endpoint and s.user_id = t.user_id;
end;
$$;

revoke all on function public.dispatch_rest_alerts() from public, anon, authenticated;
revoke all on function public.take_rest_alerts(text) from public;
grant execute on function public.take_rest_alerts(text) to anon, authenticated;

select cron.schedule('fitgym-descansos', '2 seconds', $$ select public.dispatch_rest_alerts(); $$);
