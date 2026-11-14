// Captures the product screenshots the website shows, from a demo company, and saves them as WebP in src/public/shots.
//
//   (steps 1-3 run inside the hycros product repository, not here)
//   1. pnpm --filter @sp/server setup --create --database hycros_screens --company "Acme Corp" --admin-name "Asha Menon" --admin-email asha@acme-demo.test --admin-password "Demo-Pass-2026-Screens!"
//   2. cd server && DB_DATABASE=hycros_screens npx tsx scripts/seed-demo.ts --database hycros_screens
//   3. API:  DB_DATABASE=hycros_screens SP_SERVER_PORT=4201 SP_REDIS=0 SP_SESSION_DIR=<an existing folder> pnpm --filter @sp/server start
//      Web:  SP_ORIGIN=http://127.0.0.1:4201 pnpm --filter @sp/web exec vite --port 5180 --strictPort
//   4. HYCROS_REPO=<path to the hycros product checkout> node capture-shots.cjs [name]
//
// Never point this at a real company: the screens are published on the website. The demo database is throwaway and the
// seed refuses any database that does not end in _screens or _demo. The product logo is swapped for the HYCROS mark.
const path = require("node:path");
const { chromium } = require(
  require.resolve("playwright-core", {
    paths: [
      process.cwd(),
      __dirname,
      path.join(__dirname, "node_modules"),
      process.env.HYCROS_REPO ? path.join(process.env.HYCROS_REPO, "node_modules", ".pnpm", "node_modules") : __dirname,
    ],
  }),
);
const fs = require("node:fs");

const BASE = process.env.SHOTS_BASE ?? "http://localhost:5180";
const EMAIL = process.env.SHOTS_EMAIL ?? "asha@acme-demo.test";
const PASSWORD = process.env.SHOTS_PASSWORD ?? "Demo-Pass-2026-Screens!";
const OUT = path.join(__dirname, "src", "public", "shots");
const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const quiet = `#wellnessIndicatorWrap,#appStartPageTour,#wellnessOnboardingModal,.modal-backdrop,.app-toast-stack,.navi-companion{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="36" viewBox="0 0 150 36"><rect width="36" height="36" rx="10" fill="#4145D8"/><path d="M10 9v18M26 9v18M10 18h16" stroke="#fff" stroke-width="3.8" stroke-linecap="round" fill="none"/><text x="46" y="26" font-family="Arial,sans-serif" font-weight="800" font-size="22" fill="#1E201D">HYCROS</text></svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })
  ).newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(EMAIL);
  await page.locator("#login-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 });

  const openBoard = async () => {
    await page.getByRole("tab", { name: /board/i }).first().click({ timeout: 8000 });
    await page.waitForTimeout(800);
    await page
      .getByRole("heading", { name: "Board", exact: true })
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await page.evaluate(() => window.scrollBy(0, 330));
  };
  const shots = [
    ["dashboard", "/dashboard"],
    ["tasks", "/tasks"],
    ["boards", "/projects/view?id=1", openBoard],
    ["leads", "/leads"],
    ["timesheet", "/timesheets/list"],
    ["people", "/calendar/team"],
    ["reports", "/reports/resource-allocation"],
  ];
  for (const [name, route, act] of shots) {
    if (only && only !== name) continue;
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    for (const label of ["Skip tour", "Close", "Got it", "Dismiss", "Not now"]) {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if (await button.isVisible().catch(() => false)) await button.click().catch(() => {});
    }
    if (act) await act().catch((e) => console.log(name, "step failed:", e.message.slice(0, 100)));
    await page.addStyleTag({ content: quiet });
    await page.evaluate((svg) => {
      document.querySelectorAll("img").forEach((img) => {
        if (!/logo/i.test(img.getAttribute("src") || "")) return;
        const box = document.createElement("span");
        box.innerHTML = svg;
        img.replaceWith(box);
      });
    }, mark);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    const png = await page.screenshot();
    // Chromium has no WebP screenshot, so the PNG is re-encoded through a canvas.
    const webp = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      return canvas.toDataURL("image/webp", 0.88).split(",")[1];
    }, png.toString("base64"));
    fs.writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(webp, "base64"));
    console.log("saved", name);
  }
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
