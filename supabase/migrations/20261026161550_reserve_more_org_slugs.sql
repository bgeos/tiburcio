-- P2-07 · Organization addresses (slugs) are the first URL segment (D-016), so they
-- must never collide with app-level routes. Replaces the unnamed reserved-words check
-- from 20261026154738 with a named one that also reserves the new routes.
-- Non-destructive: it only adds words, and existing slugs are re-checked when the
-- constraint is added.

alter table public.organizations drop constraint organizations_slug_check1;

alter table public.organizations
  add constraint organizations_slug_not_reserved check (slug not in (
    -- routes and route-like words
    'api', 'auth', 'login', 'logout', 'signup', 'sign-up', 'invite', 'invitations',
    'accept-invite', 'no-organization', 'onboarding', 'welcome', 'account', 'profile',
    'design', 'admin', 'static', 'public', 'assets', 'new', 'help', 'about',
    -- section names (pages live under /<slug>/<section>)
    'settings', 'dashboard', 'projects', 'tasks', 'materials', 'reports', 'team'
  ));
