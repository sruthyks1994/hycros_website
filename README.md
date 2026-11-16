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
| `site.config.json`  | Domains, sign-up link, contact email, prices, `annualDiscountPercent` and the `legal` details. A `null` price shows "Announced at launch" |
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

The website does not show the product's help text. Each feature's name and one-line description come from
`data/feature-copy.json`, written in plain words for managers and non-technical buyers. After a refresh, the build lists
any new feature that has no entry there yet, so add a line for it. Group headings, their intros and the features left
off the page are set in `GROUPS` and `HIDE` in `build.mjs`.

## Screenshots

The real product screens come from a demo company: `HYCROS_REPO=<hycros checkout> node capture-shots.cjs` (the steps to set it up are at the top of
that file and run in the product repository; the seed is `server/scripts/seed-demo.ts` there). Re-run it when the product's look changes.

Pages expect these files in `src/public/shots/` (WebP, 1440x900): `dashboard`, `tasks`, `boards`, `leads`, `timesheet`,
`people`, `reports`. A missing file shows a marked "Product screenshot goes here" box, so the site never shows a broken image.
Capture them from a demo company, never from real customer data.

## Before launch

`node build.mjs` prints a "Before launch" line for each setting that is still missing.

- Set `contactEmail`, the real prices, and `annualDiscountPercent`
  ("Save 20% with yearly billing") in `site.config.json`. Until then the site shows the wording without figures.
- Have the privacy policy (`/privacy/`) approved by your legal
  adviser, and fill in the `legal` block in `site.config.json` (company name, address, Grievance Officer, hosting
  provider and location, email provider, log retention). Missing details show as highlighted placeholders, and the
  build counts them. The terms page is still an outline and needs writing.
- Once approved, remove `"noindex": true` and the draft notice from the terms and privacy pages. The sign-up
  page stores the version of the terms each person accepted (`TERMS_VERSION` in `platform-admin/src/signup/signup.ts`
  in the product repository); bump it whenever the terms or privacy text changes.
- Point `signupUrl` at the platform-admin sign-up page and `appUrl` at the product.
- The platform-admin sign-up page needs `PLATFORM_SIGNUP_ENABLED=1` and a CSP that allows the captcha (see the plan, Phase 4).

## Social image and icons

`src/public/og.png` (1200x630) is the link preview that social sites show; `og.svg` is its source. `apple-touch-icon.png` (180x180)
is the home-screen icon. When `og.svg` changes, re-render the PNG at 1200x630, for example with headless Chrome:
`chrome --headless --hide-scrollbars --window-size=1200,630 --screenshot=og.png og.svg`.

## Deploy

`deploy/marketing-site.sh` builds the site, serves it on nginx at the marketing domain, and publishes only the sign-up pages of the
Platform Admin service on a second domain (the console stays private), with a CSP that allows Cloudflare Turnstile and HTTPS from
certbot. Run the script as root on the server, with both domains pointing at it; its header lists the settings. The Platform Admin
service itself, and its systemd unit `deploy/platform-admin.service`, live in the product repository.
