import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/** Manages the Playwright browser instance connected to the user's Chrome profile. */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /** Launch browser with the user's Chrome profile so ChatGPT login is preserved. */
  async launch(profilePath?: string): Promise<Page> {
    this.browser = await chromium.launch({ headless: false });

    const contextOpts: Record<string, unknown> = {};
    if (profilePath) {
      contextOpts.userDataDir = profilePath;
    }

    this.context = await this.browser.newContext(contextOpts);
    this.page = await this.context.newPage();
    await this.page.goto("https://chatgpt.com");
    return this.page;
  }

  /** Get the active page. Throws if browser hasn't been launched. */
  getPage(): Page {
    if (!this.page) throw new Error("Browser not launched. Call launch() first.");
    return this.page;
  }

  /** Close the browser. */
  async close(): Promise<void> {
    await this.page?.close();
    await this.context?.close();
    await this.browser?.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
