const fs = require("fs");
const path = require("path");

const OUT = process.env.CAPTURE_DIR || "C:\\Users\\user\\Desktop\\js dev\\RSV_Helmet\\.dsh-preview";
const LOG = path.join(OUT, "capture.log");
const log = (msg) => {
  try {
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* ignore */
  }
};

const electron = require("electron");
const { app, BrowserWindow } = electron;
const URL = process.env.CAPTURE_URL || "http://127.0.0.1:8971/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resize(win, width, height) {
  win.setContentSize(width, height);
  await sleep(500);
}

async function capture(win, file, width, height, full = false) {
  await resize(win, width, height);
  let shotHeight = height;
  if (full) {
    const pageHeight = await win.webContents.executeJavaScript(
      "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)",
    );
    shotHeight = Math.min(Math.max(pageHeight, height), 7000);
    win.setContentSize(width, shotHeight);
    await sleep(700);
  }
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, file), image.toPNG());
  log(`saved ${file} (${width}x${shotHeight})`);
  if (full) await resize(win, width, height);
}

async function clickText(win, text) {
  return win.webContents.executeJavaScript(`(() => {
    const el = [...document.querySelectorAll("button, a")].find(
      (n) => n.textContent.replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)},
    );
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function step(label, fn) {
  try {
    await fn();
  } catch (err) {
    log(`STEP FAILED ${label}: ${err && err.stack ? err.stack : err}`);
  }
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  log("app ready");
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: false,
    webPreferences: { offscreen: true, deviceScaleFactor: 1, backgroundThrottling: false },
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load ${code} ${desc}`));

  await step("load", async () => {
    await win.loadURL(URL);
    await sleep(1500);
  });

  await step("guest desktop", () => capture(win, "guest-desktop.png", 1440, 1000, true));
  await step("guest mobile", () => capture(win, "guest-mobile.png", 390, 844, true));

  await step("login", async () => {
    await resize(win, 1440, 1000);
    await win.webContents.executeJavaScript(`
      localStorage.setItem("rsv_auth_token", "preview-token");
      localStorage.setItem("rsv_auth_user", JSON.stringify({
        id: 1, name: "Andi Pratama", email: "andi@rsvhelmet.com", role: "admin"
      }));
      true;
    `);
    await win.webContents.reload();
    await sleep(1800);
  });

  await step("admin desktop", () => capture(win, "admin-desktop.png", 1440, 1000, true));

  await step("scan sheet desktop", async () => {
    await resize(win, 1440, 1000);
    log(`scan click: ${await clickText(win, "Scan Barang")}`);
    await sleep(800);
    await capture(win, "admin-scan-sheet.png", 1440, 1000);
  });

  await step("scan sheet mobile", async () => {
    await clickText(win, "Batal");
    await sleep(300);
    await resize(win, 390, 844);
    await clickText(win, "Scan Barang");
    await sleep(800);
    await capture(win, "admin-scan-mobile.png", 390, 844, true);
  });

  await step("account menu", async () => {
    await clickText(win, "Batal");
    await resize(win, 1440, 1000);
    await win.webContents.reload();
    await sleep(1500);
    await win.webContents.executeJavaScript(`document.querySelector('[aria-haspopup="menu"]')?.click(); true`);
    await sleep(600);
    await capture(win, "admin-menu.png", 1440, 720);
  });

  log("done");
  app.quit();
});

app.on("window-all-closed", () => app.quit());
process.on("uncaughtException", (err) => log(`uncaught ${err && err.stack ? err.stack : err}`));
