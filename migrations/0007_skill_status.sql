alter table skills add column if not exists status text not null default 'approved';
alter table skills add column if not exists requested_by text;
update skills set status = 'approved' where status is null or status = '';
