/**
 * The app's two views, chosen by path.
 *
 * The projection page is the product, and every path renders it: a shared
 * link, a stale bookmark or a typo all land on a projection rather than an
 * error. The design system preview is a development tool. It answers only at
 * `/design-system`, and only in a development build: `import.meta.env.DEV` is
 * replaced with `false` in production, so the preview and its placeholder
 * curves are dropped from the bundle rather than merely hidden.
 *
 * No router library: two views do not need one, and the URL's query string is
 * reserved for the projection's shareable state.
 */

export type Route = 'projection' | 'design-system';

export const DESIGN_SYSTEM_PATH = '/design-system';

export function routeFor(pathname: string, isDevelopment: boolean): Route {
  const normalised = pathname.replace(/\/+$/, '') || '/';
  if (isDevelopment && normalised === DESIGN_SYSTEM_PATH) return 'design-system';
  return 'projection';
}
