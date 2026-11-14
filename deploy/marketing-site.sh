#!/usr/bin/env bash
# Publishes the public website (this repository) and the free-trial sign-up host on nginx. Hosted installs only.
# Run it from inside the checkout on the server, as root, after DNS for both names points at the server:
#
#   sudo MARKETING_DOMAIN=hycros.com SIGNUP_DOMAIN=signup.hycros.com EMAIL=you@example.com bash deploy/marketing-site.sh
#
# What it does:
#   1. builds the site (node build.mjs, no dependencies) into /var/www/hycros-marketing
#   2. serves it at MARKETING_DOMAIN with security headers, long caching for css/js/images, and the site's own 404 page
#   3. runs the Platform Admin sign-up page (127.0.0.1:PLATFORM_PORT) at SIGNUP_DOMAIN, with a content policy that allows
#      Cloudflare Turnstile and nothing else, and only /signup, /api/signup and the page's own files public
#   4. gets HTTPS certificates with certbot
# The Platform Admin console (login, organisations, billing) is NOT published here: the SIGNUP_DOMAIN vhost answers 404 for
# everything except the sign-up paths. Reach the console through your VPN or another host.
#
# Settings: MARKETING_DOMAIN, SIGNUP_DOMAIN, EMAIL (required); PLATFORM_PORT (default 4100); WEB_ROOT (default /var/www/hycros-marketing).
set -euo pipefail

CODE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # the root of the hycros_website checkout
log() { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)."
: "${MARKETING_DOMAIN:?Set MARKETING_DOMAIN, for example hycros.com}"
: "${SIGNUP_DOMAIN:?Set SIGNUP_DOMAIN, for example signup.hycros.com}"
: "${EMAIL:?Set EMAIL for the certificate notices}"
PLATFORM_PORT="${PLATFORM_PORT:-4100}"
WEB_ROOT="${WEB_ROOT:-/var/www/hycros-marketing}"
command -v node >/dev/null || die "node not found."
command -v nginx >/dev/null || die "nginx not found."
[[ -f "$CODE_DIR/build.mjs" ]] || die "build.mjs is missing; run this from a hycros_website checkout."

log "1/4 Build the website"
CFG="$CODE_DIR/site.config.json"
grep -q "\"https://$MARKETING_DOMAIN\"" "$CFG" || log "Note: siteUrl in $CFG is not https://$MARKETING_DOMAIN. Fix it, then run this again."
grep -q "\"https://$SIGNUP_DOMAIN/signup\"" "$CFG" || log "Note: signupUrl in $CFG is not https://$SIGNUP_DOMAIN/signup."
node "$CODE_DIR/build.mjs"
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}"/*
cp -r "$CODE_DIR/dist/." "$WEB_ROOT/"

log "2/4 nginx: website"
cat >/etc/nginx/sites-available/hycros-marketing <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $MARKETING_DOMAIN www.$MARKETING_DOMAIN;
    root $WEB_ROOT;
    index index.html;
    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/xml;
    error_page 404 /404/index.html;

    location ~ ^/(?:\.(?!well-known/)|BitKeeper) { return 404; }
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options DENY always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' mailto:" always;

    location / { try_files \$uri \$uri/ =404; }
    location ~* \.(?:css|js|webp|svg|png|ico)\$ {
        expires 7d;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options nosniff always;
    }
}
EOF

log "3/4 nginx: sign-up host"
cat >/etc/nginx/sites-available/hycros-signup <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SIGNUP_DOMAIN;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options DENY always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    # Turnstile needs its script and frame from Cloudflare; nothing else is allowed beyond the page's own files.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'" always;

    client_max_body_size 64k;
    location = / { return 302 https://$MARKETING_DOMAIN/; }
    # Only the sign-up pages, their API and the built files they load. Everything else (the console) is not published here.
    location ~ ^/(?:signup(?:/.*)?|api/signup/(?:config|start|verify)|assets/.*|favicon\.[a-z]+)\$ {
        proxy_pass http://127.0.0.1:$PLATFORM_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location / { return 404; }
}
EOF
ln -sf /etc/nginx/sites-available/hycros-marketing /etc/nginx/sites-enabled/hycros-marketing
ln -sf /etc/nginx/sites-available/hycros-signup /etc/nginx/sites-enabled/hycros-signup
nginx -t
systemctl reload nginx

log "4/4 HTTPS"
if command -v certbot >/dev/null; then
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect \
    -d "$MARKETING_DOMAIN" -d "www.$MARKETING_DOMAIN" -d "$SIGNUP_DOMAIN"
else
  log "certbot not found: install it and run: certbot --nginx -d $MARKETING_DOMAIN -d www.$MARKETING_DOMAIN -d $SIGNUP_DOMAIN"
fi

log "Done. Next: set PLATFORM_SIGNUP_ENABLED=1, the Turnstile keys, PLATFORM_ORIGIN=https://$SIGNUP_DOMAIN, PLATFORM_MARKETING_URL and PLATFORM_APP_URL in platform-admin/.env, then restart the service."
log "Check: https://$MARKETING_DOMAIN, https://$SIGNUP_DOMAIN/signup, and that https://$SIGNUP_DOMAIN/login answers 404."
