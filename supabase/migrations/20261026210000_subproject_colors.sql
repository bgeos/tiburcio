-- Subproject colours (D-027): each subproject has a colour, used by its card, timeline
-- bar and tasks. Never red (red means overlap) and no orange (too close to red).

alter table public.subprojects
  add column color text not null default 'blue'
    constraint subprojects_color_valid check (color in ('blue', 'aqua', 'yellow', 'magenta', 'green', 'violet'));

comment on column public.subprojects.color is 'Display colour (D-027). The app suggests the least-used one in the project.';

-- Existing subprojects: the palette in display order, per project.
with ordered as (
  select id, (row_number() over (partition by project_id order by sort_order, created_at) - 1) % 6 as n
  from public.subprojects
)
update public.subprojects s
set color = (array['blue', 'aqua', 'yellow', 'magenta', 'green', 'violet'])[o.n + 1]
from ordered o
where o.id = s.id;

grant insert (color), update (color) on public.subprojects to authenticated;
