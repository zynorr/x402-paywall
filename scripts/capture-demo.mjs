import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "assets", "screenshots");
mkdirSync(outputDir, { recursive: true });

const DEMO_URL = "http://localhost:5173";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function captureScreenshots() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,800",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // Step 1: Navigate to demo page
    console.log("Step 1: Loading demo page...");
    await page.goto(DEMO_URL, { waitUntil: "networkidle0", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Wait for the page to render
    await page.waitForSelector("button, .card, [class*='card']", { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    await page.screenshot({ path: join(outputDir, "01-initial-page.png"), fullPage: false });
    console.log("  -> 01-initial-page.png saved");

    // Step 2: Click "Access Premium Data"
    console.log("Step 2: Clicking 'Access Premium Data'...");
    const buttons = await page.$$("button");
    let clicked = false;
    for (const btn of buttons) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text && text.includes("Access Premium")) {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // Try clicking any button that says "Access" or "Premium"
      for (const btn of buttons) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text && (text.includes("Access") || text.includes("Premium"))) {
          await btn.click();
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      console.log("  -> Could not find Access Premium button, trying first button...");
      if (buttons.length > 0) await buttons[0].click();
    }

    await new Promise((r) => setTimeout(r, 3000));

    await page.screenshot({ path: join(outputDir, "02-payment-modal.png"), fullPage: false });
    console.log("  -> 02-payment-modal.png saved");

    // Step 3: Click "Pay 0.01 USDC"
    console.log("Step 3: Clicking 'Pay 0.01 USDC'...");
    const buttons2 = await page.$$("button");
    let clickedPay = false;
    for (const btn of buttons2) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text && text.includes("Pay") && text.includes("USDC")) {
        await btn.click();
        clickedPay = true;
        break;
      }
    }
    if (!clickedPay) {
      // Try clicking any button with "Pay"
      for (const btn of buttons2) {
        const text = await btn.evaluate((el) => el.textContent);
        if (text && text.includes("Pay")) {
          await btn.click();
          clickedPay = true;
          break;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 3000));

    await page.screenshot({ path: join(outputDir, "03-payment-details.png"), fullPage: false });
    console.log("  -> 03-payment-details.png saved");

    // Step 4: Click "Confirm Payment"
    console.log("Step 4: Clicking 'Confirm Payment'...");
    const buttons3 = await page.$$("button");
    let clickedConfirm = false;
    for (const btn of buttons3) {
      const text = await btn.evaluate((el) => el.textContent);
      if (text && text.includes("Confirm")) {
        await btn.click();
        clickedConfirm = true;
        break;
      }
    }
    if (!clickedConfirm) {
      // Try clicking last button
      if (buttons3.length > 0) await buttons3[buttons3.length - 1].click();
    }

    await new Promise((r) => setTimeout(r, 4000));

    await page.screenshot({ path: join(outputDir, "04-premium-data.png"), fullPage: false });
    console.log("  -> 04-premium-data.png saved");

    console.log("\nAll screenshots captured successfully!");
  } catch (err) {
    console.error("Error during capture:", err.message);
    // Take a debug screenshot
    await page.screenshot({ path: join(outputDir, "debug-error.png"), fullPage: false });
  } finally {
    await browser.close();
  }
}

captureScreenshots();
