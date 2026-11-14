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
const tokens = {
  SITE_URL: config.siteUrl.replace(/\/$/, ""),
  APP_URL: config.appUrl.replace(/\/$/, ""),
  SIGNUP_URL: config.signupUrl,
  CONTACT_EMAIL: config.contactEmail,
  PRICE_STARTER: price(config.prices.starter),
  PRICE_PRO: price(config.prices.pro),
  PRICE_NOTE:
    typeof config.prices.starter === "number" ? "per user, per month" : "per user, per month",
  YEAR: String(new Date().getFullYear()),
};
// The features page lists the product's own feature guide (data/help-features.json, a copy of the product's server/src/data/help-features.json; refresh it with the steps in README.md), so it cannot drift from the product.
const GROUPS = [
  "Tasks",
  "Approvals",
  "Projects",
  "Time and meetings",
  "Assignments",
  "Leave and attendance",
  "Reports",
  "Leads and clients",
  "People and knowledge",
  "Administration",
];
const HIDE = new Set(["Error log", "Feature owners", "Online users", "Task lifecycles"]);
function featureLists() {
  const raw = JSON.parse(
    readFileSync(join(root, "data", "help-features.json"), "utf8"),
  );
  const list = Array.isArray(raw) ? raw : raw.features;
  const seen = new Set();
  return GROUPS.map((group) => {
    const titles = list
      .filter(
        (f) =>
          f.category === group &&
          !HIDE.has(f.title) &&
          !seen.has(`${group}/${f.title}`) &&
          seen.add(`${group}/${f.title}`),
      )
      .map((f) => f.title);
    if (titles.length === 0) return "";
    return `<div class="fgroup"><h2>${escape(group)}</h2><ul class="flist">${titles.map((t) => `<li>${escape(t)}</li>`).join("")}</ul></div>`;
  }).join("\n");
}
const fill = (text) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
const read = (path) => readFileSync(join(src, path), "utf8");

const header = read("partials/header.html");
const footer = read("partials/footer.html");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
tokens.FEATURES = featureLists();
tokens.CONTACT_BLOCK =
  tokens.CONTACT_EMAIL === ""
    ? `<div class="notice"><b>Contact details are not set yet.</b> Add <code>contactEmail</code> to <code>site.config.json</code> and rebuild.</div>`
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
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${url}">
${meta.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${tokens.SITE_URL}/og.svg">
<meta name="theme-color" content="#3A3ED0">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/css/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header}
<main id="main">
${body}
</main>
${footer}
<script src="/js/site.js" defer></script>
</body>
</html>
`;
  const out = meta.path === "/" ? join(dist, "index.html") : join(dist, meta.path, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, fill(html));
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

if (process.argv.includes("--serve")) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".xml": "application/xml",
    ".txt": "text/plain",
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
