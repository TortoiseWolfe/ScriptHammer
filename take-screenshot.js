const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/blog/tech-blog-guide/', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: '/home/turtle_wolfe/repos/000/public/blog-screenshot4.png',
    fullPage: true,
  });
  await browser.close();
  console.log('Screenshot saved to public/blog-screenshot4.png');
})();
