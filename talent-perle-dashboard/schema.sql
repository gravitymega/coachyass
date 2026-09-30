-- ============================================================
-- TALENT PERLÉ — Schéma Supabase pour le Dashboard de Karim
-- ============================================================
-- À exécuter UNE SEULE FOIS, dans un projet Supabase neuf :
-- Supabase → SQL Editor → coller ce fichier en entier → Run.
--
-- Ce projet Supabase est dédié à Talent Perlé, indépendant de
-- l'écosystème Gravity/OSMM (aucune table partagée).

create extension if not exists pgcrypto;

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '⭐',
  level text not null default '',
  description text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_label text not null default '',
  description text not null default '',
  poster_url text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null default '',
  link text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Lecture publique (le site public affiche ce contenu sans être connecté) ;
-- aucune politique d'écriture pour le rôle anon — les écritures passent
-- uniquement par la fonction Netlify du Dashboard (clé service_role).
alter table activities enable row level security;
alter table photos enable row level security;
alter table events enable row level security;
alter table partners enable row level security;

create policy "public read activities" on activities for select using (true);
create policy "public read photos" on photos for select using (true);
create policy "public read events" on events for select using (true);
create policy "public read partners" on partners for select using (true);

-- Bucket de stockage public pour les photos, affiches d'événements et logos.
insert into storage.buckets (id, name, public)
values ('talent-perle', 'talent-perle', true)
on conflict (id) do nothing;

create policy "public read talent-perle bucket" on storage.objects
  for select using (bucket_id = 'talent-perle');

-- Activités de départ, pour retrouver exactement ce qui est déjà sur le site
-- (y compris le remplacement d'« Activités culturelles » par « Jeu d'échecs »).
insert into activities (name, icon, level, description, sort_order) values
  ('Soccer', '⚽', 'Perfectionnement', 'Technique, tactique et jeu collectif pour progresser durablement.', 1),
  ('Volleyball', '🏐', 'Initiation', 'Les bases du jeu, la coordination et le plaisir de l''équipe.', 2),
  ('Tennis', '🎾', 'Initiation', 'Gestes fondamentaux, précision et esprit sportif, pas à pas.', 3),
  ('Basketball', '🏀', 'Initiation', 'Maniement de balle, déplacements et lecture du jeu en douceur.', 4),
  ('Jeu d''échecs', '♟️', 'Initiation', 'Stratégie, concentration et patience, un coup à la fois.', 5);
