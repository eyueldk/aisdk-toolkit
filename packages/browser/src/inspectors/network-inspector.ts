import type { HTTPRequest, HTTPResponse, Page } from "puppeteer-core";

export class NetworkInspector {
  page: Page;
  items: NetworkItem[];

  private _onRequest: (request: HTTPRequest) => Promise<void>;
  private _onResponse: (response: HTTPResponse) => Promise<void>;

  constructor({ page }: { page: Page }) {
    this.items = [];
    this.page = page;
    this._onRequest = this.onRequest.bind(this);
    this._onResponse = this.onResponse.bind(this);
  }

  start() {
    this.page.on("request", this._onRequest);
    this.page.on("response", this._onResponse);
  }

  stop() {
    this.page.off("request", this._onRequest);
    this.page.off("response", this._onResponse);
  }

  private async onRequest(request: HTTPRequest) {
    try {
      const extendedRequest = request as ExtendedHttpRequest;
      extendedRequest.id = crypto.randomUUID();
      this.items.push({
        type: "request",
        id: extendedRequest.id,
        timestamp: new Date(),
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: request.headers(),
        postData: request.hasPostData()
          ? await request.fetchPostData()
          : undefined,
      });
    } catch {
      // ignore
    }
  }

  private async onResponse(response: HTTPResponse) {
    try {
      const request = response.request();
      const extendedRequest = request as ExtendedHttpRequest;
      this.items.push({
        type: "response",
        id: extendedRequest.id,
        timestamp: new Date(),
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: response.headers(),
        statusCode: response.status(),
      });
    } catch {
      // ignore
    }
  }
}

interface ExtendedHttpRequest extends HTTPRequest {
  id: string;
}

export type NetworkItem = NetworkRequest | NetworkResponse;

export interface NetworkRequest {
  type: "request";
  id: string;
  resourceType: string;
  url: string;
  method: string;
  timestamp: Date;
  postData?: string;
  headers: Record<string, string>;
}

export interface NetworkResponse {
  type: "response";
  id: string;
  resourceType: string;
  url: string;
  method: string;
  timestamp: Date;
  statusCode: number;
  headers: Record<string, string>;
}
