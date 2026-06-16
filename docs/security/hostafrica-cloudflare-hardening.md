# HostAfrica and Cloudflare Security Hardening

Use this checklist for controls that should sit in front of the eduClub app. The backend now sets application security headers, blocks common malicious paths, rate-limits login/registration attempts, sanitizes rich lesson HTML, validates uploads, and logs key auth/registration security events. These hosting rules add another layer without changing app behavior.

## Cloudflare

Set both `educlub.co.ke` and `learn.educlub.co.ke` to proxied DNS records.

Recommended settings:

- SSL/TLS mode: `Full (strict)`.
- Edge Certificates: enable `Always Use HTTPS` and `Automatic HTTPS Rewrites`.
- WAF managed rules: enable Cloudflare Managed Rules and OWASP Core Ruleset.
- Bot protection: enable Bot Fight Mode or equivalent available plan feature.
- DDoS protection: keep Cloudflare HTTP DDoS protection enabled.

Suggested WAF custom rule:

```text
(http.request.uri.path contains ".php") or
(http.request.uri.path contains ".phtml") or
(http.request.uri.path contains ".phar") or
(http.request.uri.path contains ".exe") or
(http.request.uri.path contains ".sh") or
(http.request.uri.path contains ".ps1") or
(http.request.uri.path contains ".env") or
(http.request.uri.path contains ".git") or
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/wp-login.php") or
(http.request.uri.path contains "/xmlrpc.php") or
(http.request.uri.path contains "/phpmyadmin")
```

Action: `Block`.

Suggested rate limits:

- `/api/auth/login`: 10 requests per minute per IP.
- `/api/public/register/learner`: 5 requests per minute per IP.
- `/api/auth/password-reset/request`: 5 requests per 10 minutes per IP.
- `/api/*`: 300 requests per minute per IP, with exceptions only if a real classroom workflow needs more.

Cache rules:

- Bypass cache for `/api/*`.
- Bypass cache for auth pages and authenticated dashboard pages.
- Cache static assets only, such as JS, CSS, images, and fonts.

## cPanel / Apache

Add these rules to the site `.htaccess` or equivalent Apache include if HostAfrica allows it.

```apache
Options -Indexes

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{REQUEST_URI} (^|/)(\.env|\.git|wp-login\.php|xmlrpc\.php|wp-admin|phpmyadmin) [NC,OR]
  RewriteCond %{REQUEST_URI} \.(php[0-9]?|phtml|phar|asp|aspx|jsp|cgi|pl|exe|dll|bat|cmd|sh|ps1|scr|com)$ [NC]
  RewriteRule .* - [F,L]
</IfModule>

<FilesMatch "\.(php[0-9]?|phtml|phar|asp|aspx|jsp|cgi|pl|exe|dll|bat|cmd|sh|ps1|scr|com)$">
  Require all denied
</FilesMatch>

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  Header always set Strict-Transport-Security "max-age=15552000; includeSubDomains" env=HTTPS
</IfModule>
```

The backend already sends a Content Security Policy. If Apache must also set one for static frontend pages, use this compatible policy:

```apache
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://learn.educlub.co.ke https://educlub.co.ke https://www.educlub.co.ke"
</IfModule>
```

Avoid setting two different CSP headers at the same layer. Browser behavior becomes difficult to debug when the policies conflict.

## ModSecurity

Enable ModSecurity in cPanel if available.

Recommended mode:

- Start with OWASP CRS enabled.
- Watch logs for false positives during normal teacher/admin workflows.
- Whitelist only the exact route and rule ID causing a false positive. Do not disable ModSecurity globally.

## Ongoing Operations

- Keep database and uploaded-file backups enabled.
- Rotate SSH, cPanel, database, SMTP, and admin passwords after staff changes.
- Review application audit logs for repeated `login_failed`, `learner_registration_attempt`, and `learner_registration_failed` events.
- Ask HostAfrica whether server-side malware scanning and account-level brute-force protection are enabled.
- Keep Node dependencies patched and redeploy after security updates.
