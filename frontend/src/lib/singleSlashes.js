/**
 * A link written with a doubled slash ("https://educlub.co.ke//authentication/
 * set-password?token=...") matches no page, and showed "Page not found". Emails
 * already sent may carry such links, so the address is tidied before the router
 * reads it. Returns the tidied address, or null when there is nothing to tidy.
 */
export function singleSlashAddress({ pathname, search = "", hash = "" }) {
  if (!/\/{2,}/.test(pathname)) return null;
  return `${pathname.replace(/\/{2,}/g, "/")}${search}${hash}`;
}
