// Builds the marketing site: src/pages/*.html wrapped in the shared header and footer, written to dist/.
// No dependencies, only Node.
//
//   node build.mjs            build into dist
//   node build.mjs --serve    build, then serve dist on http://localhost:4300
//
// Settings (domains, prices, contact email) are in site.config.json. A page starts with one comment holding
// {"title": "...", "description": "...", "path": "/features/", "noindex": false}.
import { createServer } from "node:http";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));

const price = (value) =>
  typeof value === "number"
    ? `${config.currency}${value}`
    : `<span class="tbd">Announced at launch</span>`;
const escape = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tokens = {
  SITE_URL: config.siteUrl.replace(/\/$/, ""),
  APP_URL: config.appUrl.replace(/\/$/, ""),
  APP_HOST: new URL(config.appUrl).host,
  SIGNUP_URL: config.signupUrl,
  CONTACT_EMAIL: config.contactEmail,
  CURRENCY: config.currency,
  PRICE_STARTER: price(config.prices.starter),
  PRICE_PRO: price(config.prices.pro),
  PRICE_NOTE: "per user, per month",
  YEAR: String(new Date().getFullYear()),
  // "Save 20% with yearly billing" once annualDiscountPercent is set.
  ANNUAL_NOTE:
    typeof config.annualDiscountPercent === "number"
      ? `Save ${config.annualDiscountPercent}% with yearly billing`
      : "Save with yearly billing",
  // "30-day money-back guarantee" once guaranteeDays is set.
  GUARANTEE:
    typeof config.guaranteeDays === "number"
      ? `${config.guaranteeDays}-day money-back guarantee`
      : "Money-back guarantee",
};

// Settings that must be filled in before launch. The build still runs, but says what is missing.
const warnings = [];
if (!config.contactEmail) warnings.push("contactEmail is empty: the contact page shows no address or form.");
for (const plan of ["starter", "pro"])
  if (typeof config.prices[plan] !== "number")
    warnings.push(`prices.${plan} is not set: the pricing shows "Announced at launch".`);
if (typeof config.annualDiscountPercent !== "number")
  warnings.push('annualDiscountPercent is not set: the site says "Save with yearly billing" without a figure.');
if (typeof config.guaranteeDays !== "number")
  warnings.push('guaranteeDays is not set: the site says "Money-back guarantee" without a period.');

// The features page lists the product's own feature guide (data/help-features.json, a copy of the product's
// server/src/data/help-features.json; refresh it with the steps in README.md), so it cannot drift from the product.
// [category in the data, heading shown on the website]
const GROUPS = [
  ["Getting started", "Your workspace"],
  ["Tasks", "Tasks"],
  ["Approvals", "Approvals"],
  ["Projects", "Projects"],
  ["Time and meetings", "Time and meetings"],
  ["Assignments", "Assignments"],
  ["Leave and attendance", "Leave and attendance"],
  ["Reports", "Reports"],
  ["Leads and clients", "Leads and clients"],
  ["People and knowledge", "People and knowledge"],
  ["Wellness and fun", "Wellness and engagement"],
  ["Administration", "Administration"],
];
// Guide entries that are internal tools or how-to notes rather than features worth listing.
const HIDE = new Set([
  "Error log",
  "Feature owners",
  "Online users",
  "Date and time pickers",
  "Signing in and resetting your password",
  "Resigned/exited employees in reports",
  "Mascot gallery",
  "About & health, starter content and members import",
]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// One short line per feature: the summary's first sentence, cut at a colon or bracket when it runs long.
function blurb(summary = "") {
  const text = summary.replace(/HYCROS — Hybrid Cross-functional Organization Suite/g, "HYCROS").trim();
  let first = text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  if (first.length > 160) {
    const cut = first.search(/:| \(/);
    if (cut >= 40) first = `${first.slice(0, cut)}.`;
  }
  return first;
}
function featureLists() {
  const raw = JSON.parse(readFileSync(join(root, "data", "help-features.json"), "utf8"));
  const list = Array.isArray(raw) ? raw : raw.features;
  // A title is listed once, under the first group it appears in (Task lifecycles is in Tasks and Administration).
  const seen = new Set();
  const groups = GROUPS.map(([category, heading]) => {
    const items = list.filter(
      (f) => f.category === category && !HIDE.has(f.title) && !seen.has(f.title) && seen.add(f.title),
    );
    return { heading, id: slug(heading), items };
  }).filter((g) => g.items.length > 0);
  const known = new Set(GROUPS.map(([c]) => c));
  const unknown = [...new Set(list.map((f) => f.category))].filter((c) => !known.has(c));
  if (unknown.length) warnings.push(`help-features.json has categories the features page skips: ${unknown.join(", ")}.`);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const jump = `<nav class="chips jump" aria-label="Feature groups">${groups
    .map((g) => `<a class="chip" href="#${g.id}">${escape(g.heading)} <span>${g.items.length}</span></a>`)
    .join("")}</nav>`;
  const body = groups
    .map(
      (g) =>
        `<section class="fgroup" id="${g.id}" aria-labelledby="${g.id}-h"><h2 id="${g.id}-h">${escape(g.heading)}</h2><ul class="flist">${g.items
          .map((f) => `<li><b>${escape(f.title)}</b><span>${escape(blurb(f.summary))}</span></li>`)
          .join("")}</ul></section>`,
    )
    .join("\n");
  return { html: `${jump}\n${body}`, total, groups: groups.length };
}
const fill = (text) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
const read = (path) => readFileSync(join(src, path), "utf8");

const header = read("partials/header.html");
const footer = read("partials/footer.html");
const features = featureLists();
tokens.FEATURES = features.html;
tokens.FEATURE_COUNT = String(features.total);
tokens.FEATURE_GROUPS = String(features.groups);
tokens.CONTACT_BLOCK =
  tokens.CONTACT_EMAIL === ""
    ? `<div class="notice"><b>Our contact address is on its way.</b> In the meantime you can <a href="${escape(tokens.SIGNUP_URL)}" data-trial>start a free trial</a> and use <b>Contact support</b> inside the product.</div>`
    : `<p class="lede" style="margin-bottom:22px">Write to <a href="mailto:${escape(tokens.CONTACT_EMAIL)}"><b>${escape(tokens.CONTACT_EMAIL)}</b></a>, or fill in the form and your email app will open.</p>
<form class="form" action="mailto:${escape(tokens.CONTACT_EMAIL)}" method="post" enctype="text/plain">
  <label>Your name<input name="name" type="text" autocomplete="name" required></label>
  <label>Work email<input name="email" type="email" autocomplete="email" required></label>
  <label>Organisation<input name="organisation" type="text" autocomplete="organization"></label>
  <label>How can we help?<textarea name="message" required></textarea></label>
  <button class="btn primary lg" type="submit">Send message</button>
</form>`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(src, "public"), dist, { recursive: true });
cpSync(join(src, "css"), join(dist, "css"), { recursive: true });
cpSync(join(src, "js"), join(dist, "js"), { recursive: true });

const pages = [];
for (const file of readdirSync(join(src, "pages")).filter((f) => f.endsWith(".html"))) {
  const raw = read(`pages/${file}`);
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  if (!m)
    throw new Error(
      `${file}: the first line must be a <!--{...}--> comment with title, description and path.`,
    );
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length);
  const url = `${tokens.SITE_URL}${meta.path}`;
  const title = meta.path === "/" ? meta.title : `${meta.title} | HYCROS`;
  // Mark the link to the current page in the header and footer.
  const current = (part) =>
    part.replaceAll(`<a href="${meta.path}">`, `<a href="${meta.path}" aria-current="page">`);
  // Structured data for search engines, on the homepage only (a data block, so the CSP's script-src does not apply).
  const ld =
    meta.path === "/"
      ? `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "HYCROS",
              url: `${tokens.SITE_URL}/`,
              logo: `${tokens.SITE_URL}/apple-touch-icon.png`,
              ...(config.contactEmail ? { email: config.contactEmail } : {}),
            },
            {
              "@type": "SoftwareApplication",
              name: "HYCROS",
              alternateName: "Hybrid Cross-functional Organization Suite",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web, Windows, Android",
              description: meta.description,
              url: `${tokens.SITE_URL}/`,
            },
          ],
        }).replace(/</g, "\\u003c")}</script>`
      : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${url}">
${meta.noindex ? '<meta name="robots" content="noindex, follow">' : ""}
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="HYCROS">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${tokens.SITE_URL}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="HYCROS: Every task, lead and hour. One place.">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#3A3ED0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/css/site.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${current(header)}
<main id="main">
${body}
</main>
${current(footer)}
<script src="/js/site.js" defer></script>
</body>
</html>
`;
  const out = meta.path === "/" ? join(dist, "index.html") : join(dist, meta.path, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  // BASE=/hycros_website/dist node build.mjs  prefixes root-absolute links, for serving from a subfolder.
  const base = (process.env.BASE || "").replace(/\/$/, "");
  const filled = fill(html);
  writeFileSync(
    out,
    base ? filled.replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`) : filled,
  );
  pages.push(meta);
}

const indexable = pages.filter((p) => !p.noindex);
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable
    .map((p) => `  <url><loc>${tokens.SITE_URL}${p.path}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(
  join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${tokens.SITE_URL}/sitemap.xml\n`,
);
console.log(`Built ${pages.length} pages into ${dist}`);
for (const w of warnings) console.warn(`  Before launch: ${w}`);

if (process.argv.includes("--serve")) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json",
    ".ico": "image/x-icon",
  };
  createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(
      /^([/\\])+/,
      "",
    );
    let file = join(dist, path);
    if (!file.startsWith(dist)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": types[".html"] });
      return res.end(readFileSync(join(dist, "404", "index.html")));
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  }).listen(4300, () => console.log("Serving http://localhost:4300"));
}
