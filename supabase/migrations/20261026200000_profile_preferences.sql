-- Personal appearance (D-027): each person picks a theme colour and light/dark mode.
-- Stored on their own profile so it follows them to any device. RLS is unchanged:
-- "profiles: update own" already limits writes to the person themselves.

alter table public.profiles
  add column accent_color text not null default 'green'
    constraint profiles_accent_color_valid check (accent_color in ('green', 'teal', 'blue', 'violet', 'pink', 'slate')),
  add column theme_mode text not null default 'system'
    constraint profiles_theme_mode_valid check (theme_mode in ('light', 'dark', 'system'));

comment on column public.profiles.accent_color is 'Theme colour of the app for this person (D-027). Never red: red means overlap.';
comment on column public.profiles.theme_mode is 'light, dark, or system (follow the device).';

grant update (accent_color, theme_mode) on public.profiles to authenticated;
