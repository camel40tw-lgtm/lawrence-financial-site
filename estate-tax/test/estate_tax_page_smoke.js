const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "output", "playwright");
const PAGE_URL = process.env.ESTATE_TAX_URL || `file:///${path.join(ROOT, "estate-tax", "index.html").replace(/\\/g, "/")}`;

async function checkViewport(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  const logs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") logs.push(msg.text());
  });
  page.on("pageerror", (err) => logs.push(err.message));

  await page.goto(PAGE_URL, { waitUntil: "load" });
  await page.screenshot({
    path: path.join(OUT_DIR, `estate-tax-${name}.png`),
    fullPage: true,
  });

  const title = await page.locator("h1").innerText();
  const initialTax = await page.locator("#resultEstateTax").innerText();

  await page.locator("#grossEstate").fill("120000000");
  await page.locator("#dailyNecessitiesValue").fill("2000000");
  await page.locator("#workToolsValue").fill("1000000");
  await page.locator("#spouseCount").selectOption("0");
  await page.locator("#linealDescCount").fill("0");
  await page.locator("#funeralDeductionEnabled").setChecked(false);
  await page.waitForTimeout(150);

  const updatedTax = await page.locator("#resultEstateTax").innerText();
  const netEstate = await page.locator("#statNetEstate").innerText();
  const copyEnabled = await page.locator("#copySummary").isEnabled();
  const printEnabled = await page.locator("#printResult").isEnabled();

  await page.close();
  return { name, title, initialTax, updatedTax, netEstate, copyEnabled, printEnabled, logs };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [
      await checkViewport(browser, "desktop", { width: 1440, height: 1100 }),
      await checkViewport(browser, "mobile", { width: 390, height: 844 }),
    ];

    const consoleErrors = results.flatMap((result) => result.logs.map((log) => `${result.name}: ${log}`));
    if (consoleErrors.length) {
      throw new Error(`Console/page errors:\n${consoleErrors.join("\n")}`);
    }
    for (const result of results) {
      if (result.title !== "台灣遺產稅試算") throw new Error(`${result.name}: unexpected title ${result.title}`);
      if (!result.updatedTax.includes("NT$")) throw new Error(`${result.name}: missing updated tax`);
      if (!result.copyEnabled || !result.printEnabled) throw new Error(`${result.name}: action button disabled`);
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})();
