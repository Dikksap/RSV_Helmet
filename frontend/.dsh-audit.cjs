const fs = require("fs");
const path = require("path");

const OUT = process.env.CAPTURE_DIR || "C:\\Users\\user\\Desktop\\js dev\\RSV_Helmet\\.dsh-preview";
const PREFIX = process.env.CAPTURE_PREFIX || "audit";
const BASE = process.env.CAPTURE_URL || "http://127.0.0.1:5173";
const TOKEN = fs.readFileSync(path.join(OUT, "token.txt"), "utf8").trim();
const LOG = path.join(OUT, `${PREFIX}.log`);
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`);

const { app, BrowserWindow } = require("electron");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(win, file, width, height) {
  win.setContentSize(width, height);
  await sleep(700);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `${PREFIX}-${file}.png`), image.toPNG());
  log(`saved ${PREFIX}-${file}.png (${width}x${height})`);
}

async function goto(win, route, wait = 1800) {
  await win.loadURL(BASE + route);
  await sleep(wait);
}

async function metrics(win, label) {
  try {
    const data = await win.webContents.executeJavaScript(`(() => {
      const doc = document.documentElement;
      const header = document.querySelector("header");
      const aside = document.querySelector("aside");
      const main = document.querySelector("main");
      return {
        path: location.pathname,
        docScrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        overflowX: doc.scrollWidth > doc.clientWidth + 1,
        headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
        asideW: aside ? Math.round(aside.getBoundingClientRect().width) : null,
        mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
        mainPadLeft: main ? getComputedStyle(main).paddingLeft : null,
        title: document.querySelector("main h1, header h1")?.textContent?.trim() ?? null,
      };
    })()`);
    log(`${label} ${JSON.stringify(data)}`);
  } catch (error) {
    log(`${label} metrics failed: ${error}`);
  }
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  log("start");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: { offscreen: true, deviceScaleFactor: 1, backgroundThrottling: false },
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load ${code} ${desc}`));

  await goto(win, "/", 1200);
  await win.webContents.executeJavaScript(`
    localStorage.setItem("rsv_auth_token", ${JSON.stringify(TOKEN)});
    localStorage.setItem("rsv_auth_user", JSON.stringify({
      id: 1, name: "Admin", email: "admin@example.com", role: "admin", avatarUrl: "/api/auth/me/avatar"
    }));
    true;
  `);

  const desktopRoutes = (process.env.CAPTURE_ROUTES || "/admin/home,/admin/item,/admin/barang,/admin/permintaan-barang,/admin/stok-opname").split(",");
  for (const route of desktopRoutes) {
    const slug = route.replace(/\/admin\/?/, "").replace(/\//g, "-") || "home";
    await goto(win, route);
    await metrics(win, `desktop ${route}`);
    await shot(win, `desk-${slug}`, 1440, 900);
  }

  await goto(win, "/admin/home");
  await shot(win, "desk-home-collapsed", 1440, 900);
  await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Ciutkan sidebar"], [aria-label="Perluas sidebar"]')?.click(); true`);
  await sleep(600);
  await shot(win, "desk-home-collapsed-toggle", 1440, 900);

  await goto(win, "/admin/item");
  await win.webContents.executeJavaScript(`document.querySelector('[aria-haspopup="menu"]')?.click(); true`);
  await sleep(500);
  await shot(win, "desk-item-menu", 1440, 900);

  await goto(win, "/admin/home");
  await shot(win, "mobile-home", 390, 844);
  await win.webContents.executeJavaScript(`document.querySelector('[aria-label="Buka navigasi"]')?.click(); true`);
  await sleep(500);
  await shot(win, "mobile-drawer", 390, 844);

  await goto(win, "/admin/item");
  await metrics(win, "mobile /admin/item");
  await shot(win, "mobile-item", 390, 844);

  await goto(win, "/admin/home");
  await shot(win, "tablet-home", 820, 1180);

  log("done");
  app.quit();
});

app.on("window-all-closed", () => app.quit());
process.on("uncaughtException", (err) => log(`uncaught ${err && err.stack ? err.stack : err}`));

