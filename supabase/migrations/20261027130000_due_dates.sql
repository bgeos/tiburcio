-- D-034 · Dates for materials ("needed by") and my tasks ("due"), shown on the calendar.
-- Both optional. Non-destructive: two nullable columns; existing rows keep no date.
-- RLS is unchanged: the existing policies already decide who may write each row,
-- so only the column grants are extended.

alter table public.subproject_materials add column needed_by date;
comment on column public.subproject_materials.needed_by is 'The day the material must be on site; optional.';

alter table public.personal_tasks add column due_date date;
comment on column public.personal_tasks.due_date is 'The day the to-do or reminder is for; optional.';

grant insert (needed_by), update (needed_by) on public.subproject_materials to authenticated;
grant insert (due_date), update (due_date) on public.personal_tasks to authenticated;

create index subproject_materials_needed_by_idx on public.subproject_materials (organization_id, needed_by) where needed_by is not null;
