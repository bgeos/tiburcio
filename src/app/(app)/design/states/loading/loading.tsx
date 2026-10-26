/**
 * A segment needs its own loading boundary for client navigations: the
 * (app)/loading.tsx boundary sits at the shared layout and is not re-shown
 * when navigating between pages inside the app shell.
 */
export { default } from "../../../loading";
