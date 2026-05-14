import type { ConsoleMessage, Page } from "puppeteer-core";

export class ConsoleInspector {
  page: Page;
  items: ConsoleMessage[];

  private _onMessage: (message: ConsoleMessage) => void;

  constructor({ page }: { page: Page }) {
    this.items = [];
    this.page = page;
    this._onMessage = this.onMessage.bind(this);
  }

  start() {
    this.page.on("console", this._onMessage);
  }

  stop() {
    this.page.off("console", this._onMessage);
  }

  private onMessage(message: ConsoleMessage) {
    this.items.push(message);
  }
}
