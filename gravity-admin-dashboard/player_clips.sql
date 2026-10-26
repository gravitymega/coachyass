-- Système Player : stats automatiques, clips et devoirs envoyés par Art craft (module « Stats auto »)
-- dans l'Espace Joueurs. Appliqué le 22 octobre 2026 (migration « player_clips_assignments »).
-- Additif : aucune colonne ni table existante n'est modifiée ou supprimée.

-- 1. Stats détaillées par match (la table player_stats existait déjà : points, rebonds, passes, interceptions).
alter table public.player_stats
  add column if not exists game_id uuid references public.team_games(id) on delete set null,
  add column if not exists off_rebounds integer,
  add column if not exists blocks integer,
  add column if not exists turnovers integer,
  add column if not exists fouls integer,
  add column if not exists fg2_made integer,
  add column if not exists fg2_att integer,
  add column if not exists fg3_made integer,
  add column if not exists fg3_att integer,
  add column if not exists ft_made integer,
  add column if not exists ft_att integer,
  add column if not exists source text;

-- 2. Clips vidéo des actions d'un joueur (fichiers dans le bucket privé player-clips).
create table if not exists public.player_clips (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'gravity-basketball',
  player_id uuid not null references public.players(id) on delete cascade,
  game_id uuid references public.team_games(id) on delete set null,
  game_date date,
  adversaire text,
  event_type text not null,
  titre text,
  t_seconds numeric,
  file_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists player_clips_player_idx on public.player_clips (player_id, game_date desc);

-- 3. Bilan d'après-match (points forts / à travailler) et devoirs (exercices) d'un joueur.
create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'gravity-basketball',
  player_id uuid not null references public.players(id) on delete cascade,
  game_id uuid references public.team_games(id) on delete set null,
  game_date date,
  adversaire text,
  points_forts text[] not null default '{}',
  points_faibles text[] not null default '{}',
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.player_assignments (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'gravity-basketball',
  player_id uuid not null references public.players(id) on delete cascade,
  report_id uuid references public.player_reports(id) on delete cascade,
  titre text not null,
  categorie text,
  description text,
  repetitions text,
  duree_min integer,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'fait')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists player_assignments_player_idx on public.player_assignments (player_id, created_at desc);

-- RLS : l'admin gère tout (via admin_users.sites), le joueur ne voit que ses propres lignes.
alter table public.player_clips enable row level security;
alter table public.player_reports enable row level security;
alter table public.player_assignments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['player_clips', 'player_reports', 'player_assignments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.admin_users au where au.id = auth.uid() and %I.site = any (au.sites)))
      with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and %I.site = any (au.sites)))$p$,
      t || '_admin_all', t, t, t);
    execute format('drop policy if exists %I on public.%I', t || '_player_read', t);
    execute format($p$create policy %I on public.%I for select to authenticated
      using (exists (select 1 from public.players p where p.id = %I.player_id and p.auth_user_id = auth.uid()))$p$,
      t || '_player_read', t, t);
  end loop;
end $$;

-- Le joueur coche « fait » sur ses devoirs (et seulement ça) : fonction dédiée plutôt qu'un droit d'écriture.
create or replace function public.set_assignment_status(p_id uuid, p_done boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.player_assignments a
     set statut = case when p_done then 'fait' else 'a_faire' end,
         done_at = case when p_done then now() else null end
   where a.id = p_id
     and exists (select 1 from public.players p where p.id = a.player_id and p.auth_user_id = auth.uid());
$$;
revoke all on function public.set_assignment_status(uuid, boolean) from public, anon;
grant execute on function public.set_assignment_status(uuid, boolean) to authenticated;

-- Stockage privé des clips : chemins <date>_<équipe>/<fichier>.mp4, lus par URL signée.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-clips', 'player-clips', false, 52428800, array['video/mp4'])
on conflict (id) do nothing;

drop policy if exists player_clips_bucket_admin_all on storage.objects;
create policy player_clips_bucket_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'player-clips' and exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (bucket_id = 'player-clips' and exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists player_clips_bucket_player_read on storage.objects;
create policy player_clips_bucket_player_read on storage.objects for select to authenticated
  using (bucket_id = 'player-clips' and exists (
    select 1 from public.player_clips pc join public.players p on p.id = pc.player_id
     where pc.file_path = storage.objects.name and p.auth_user_id = auth.uid()));
