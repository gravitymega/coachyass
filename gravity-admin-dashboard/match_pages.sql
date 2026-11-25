-- Pages de match à partager (Art craft, module « Stats auto », 25 novembre 2026).
-- Une page = un dossier <id>/ dans le bucket public « match-pages » :
--   <id>/data.json (score, feuille de stats, noms selon le choix du coach),
--   <id>/reels/<numero>.mp4 (highlight vertical de chaque joueur),
--   <id>/clips/<n>.mp4 (une action par clip).
-- La page publique gravity.osmm-mtl.site/match.html?id=<id> lit ces fichiers sans compte.
-- L'id est un UUID aléatoire : le lien est la seule clé (comme une vidéo « non répertoriée »).
-- Aucune règle de lecture sur storage.objects : on lit un fichier par son adresse,
-- mais personne ne peut lister le bucket pour trouver les autres pages.
-- Additif : rien d'existant n'est modifié. À coller dans Supabase → SQL Editor → Run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-pages', 'match-pages', true, 52428800, array['video/mp4', 'application/json'])
on conflict (id) do nothing;

-- Seuls les admins du Dashboard (table admin_users) déposent, remplacent et suppriment.
drop policy if exists match_pages_admin_insert on storage.objects;
create policy match_pages_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'match-pages' and exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists match_pages_admin_update on storage.objects;
create policy match_pages_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'match-pages' and exists (select 1 from public.admin_users au where au.id = auth.uid()))
  with check (bucket_id = 'match-pages' and exists (select 1 from public.admin_users au where au.id = auth.uid()));

-- Lecture par l'admin seulement (nécessaire pour remplacer un fichier avec x-upsert et pour supprimer).
drop policy if exists match_pages_admin_select on storage.objects;
create policy match_pages_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'match-pages' and exists (select 1 from public.admin_users au where au.id = auth.uid()));

drop policy if exists match_pages_admin_delete on storage.objects;
create policy match_pages_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'match-pages' and exists (select 1 from public.admin_users au where au.id = auth.uid()));
