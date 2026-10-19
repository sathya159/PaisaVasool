-- Run AFTER community-chat.sql. Safe to rerun. Existing messages are retained.
alter table public.community_messages add column if not exists image_path text;
alter table public.community_messages drop constraint if exists community_messages_body_check;
alter table public.community_messages add constraint community_messages_body_check check (
 length(trim(body)) <= 2000 and (length(trim(body)) > 0 or image_path is not null)
);
alter table public.community_messages drop constraint if exists community_messages_image_path_check;
alter table public.community_messages add constraint community_messages_image_path_check check (
 image_path is null or (split_part(image_path,'/',1)=user_id::text and image_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$')
);
grant insert (image_path) on public.community_messages to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('community-images','community-images',false,5000000,array['image/jpeg','image/png','image/webp'])
 on conflict (id) do update set public=false,file_size_limit=5000000,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Members upload own chat pictures" on storage.objects;
create policy "Members upload own chat pictures" on storage.objects for insert to authenticated
 with check (bucket_id='community-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Members view shared chat pictures" on storage.objects;
create policy "Members view shared chat pictures" on storage.objects for select to authenticated
 using (bucket_id='community-images' and exists(select 1 from public.community_messages m where m.image_path=name));
-- Pictures use expiring signed URLs and are readable only once attached to a message.
-- No anonymous access, overwrite or delete permissions are granted to members.

