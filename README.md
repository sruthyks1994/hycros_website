# HYCROS marketing site

The public website: home, features, pricing, security, contact, terms and privacy. Plain static HTML built by a small Node
script with no dependencies, so there is nothing to install. It lives in its own repository, apart from the HYCROS product code.

```bash
node build.mjs            # build into dist
node build.mjs --serve    # build and serve on http://localhost:4300
```

## Layout

| Path                | What                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `site.config.json`  | Domains, the sign-up link, contact email and prices. `null` price shows "Announced at launch" |
| `src/pages/*.html`  | One file per page. The first line is a comment with `title`, `description`, `path`, `noindex` |
| `src/partials/`     | Shared header and footer                                                                      |
| `src/css`, `src/js` | Styles and the small script (menu, tour tabs, screenshot fallback)                            |
| `src/public/`       | Copied as is: favicon, `og.svg`. Screenshots go in `src/public/shots/`                        |
| `dist/`             | The build output (not in git). Serve it from nginx at the marketing domain                    |

Tokens such as `{{SIGNUP_URL}}` and `{{PRICE_PRO}}` in pages are filled from `site.config.json`. `{{FEATURES}}` on the
features page is built from `data/help-features.json`, a copy of the product's `server/src/data/help-features.json`. Refresh it when the product's features change:

```bash
cp <hycros checkout>/server/src/data/help-features.json data/help-features.json
```

## Screenshots

The real product screens come from a demo company: `HYCROS_REPO=<hycros checkout> node capture-shots.cjs` (the steps to set it up are at the top of
that file and run in the product repository; the seed is `server/scripts/seed-demo.ts` there). Re-run it when the product's look changes.

Pages expect these files in `src/public/shots/` (WebP, 1440x900): `dashboard`, `tasks`, `boards`, `leads`, `timesheet`,
`people`, `reports`. A missing file shows a marked "Product screenshot goes here" box, so the site never shows a broken image.
Capture them from a demo company, never from real customer data.

## Before launch

- Set `contactEmail` and the real prices in `site.config.json`.
- Replace the draft terms and privacy pages with approved text, then remove `"noindex": true` from both.
- Add a PNG for `og.svg` (most social sites ignore SVG previews).
- Point `signupUrl` at the platform-admin sign-up page and `appUrl` at the product.
- The platform-admin sign-up page needs `PLATFORM_SIGNUP_ENABLED=1` and a CSP that allows the captcha (see the plan, Phase 4).

## Deploy

`deploy/marketing-site.sh` builds the site, serves it on nginx at the marketing domain, and publishes only the sign-up pages of the
Platform Admin service on a second domain (the console stays private), with a CSP that allows Cloudflare Turnstile and HTTPS from
certbot. `deploy/platform-admin.service` is the systemd unit for that service. Run the script as root on the server, with both domains
pointing at it; its header lists the settings.

## Deploy

`deploy/marketing-site.sh` builds the site and sets up nginx for the website and the free-trial sign-up host. The sign-up host proxies to the Platform Admin service, which stays in the product repository (with its `deploy/platform-admin.service`).
