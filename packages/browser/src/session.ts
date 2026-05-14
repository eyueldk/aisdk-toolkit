import type { Page } from "puppeteer-core";
import { ConsoleInspector } from "./inspectors/console-inspector";
import { NetworkInspector } from "./inspectors/network-inspector";

export class Session {
  page: Page;
  consoleInspector: ConsoleInspector;
  networkInspector: NetworkInspector;

  private _closed = false;

  constructor({ page }: { page: Page }) {
    this.page = page;
    this.networkInspector = new NetworkInspector({ page });
    this.consoleInspector = new ConsoleInspector({ page });
    this.networkInspector.start();
    this.consoleInspector.start();
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this.networkInspector.stop();
    this.consoleInspector.stop();
  }
}
