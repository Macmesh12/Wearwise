-- Use pg_net directly because some projects do not have the dashboard
-- webhook helper schema (supabase_functions) installed.
create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_admin_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://qavvobfskuhebepnglhh.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'admin_notifications',
      'record', jsonb_build_object('id', new.id)
    )
  );
  return new;
end;
$$;

revoke all on function public.enqueue_admin_push_notification() from public, anon, authenticated;
drop trigger if exists enqueue_admin_push_notification_trigger on public.admin_notifications;
create trigger enqueue_admin_push_notification_trigger
  after insert on public.admin_notifications
  for each row execute function public.enqueue_admin_push_notification();