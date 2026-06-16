import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createShortLinkServer } from "../../src/server.js";
import {
  JsonShortLinkRepository,
  type ShortLinkRecord,
} from "../../src/short-links/index.js";

describe("short link HTTP API", () => {
  let tempDir: string;
  let repository: JsonShortLinkRepository;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "short-link-api-test-"));
    repository = new JsonShortLinkRepository(join(tempDir, "short-links.json"));
    server = createShortLinkServer({ repository });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    assert(address !== null && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await rm(tempDir, { force: true, recursive: true });
  });

  it("returns health status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
  });

  it("creates a short link and returns a shortUrl", async () => {
    const response = await postJson(`${baseUrl}/api/short-links`, {
      url: "https://example.com/articles/api-test",
    });
    const body = (await response.json()) as ShortLinkRecord;

    assert.equal(response.status, 201);
    assert.equal(body.originalUrl, "https://example.com/articles/api-test");
    assert.match(body.shortCode, /^[A-Za-z0-9]{6}$/);
    assert.equal(body.shortUrl, `${baseUrl}/${body.shortCode}`);
    assert.equal(body.clickCount, 0);

    const saved = await repository.findByShortCode(body.shortCode);
    assert.equal(saved?.originalUrl, "https://example.com/articles/api-test");
  });

  it("rejects unsupported URL schemes", async () => {
    const response = await postJson(`${baseUrl}/api/short-links`, {
      url: "javascript:alert(1)",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      code: "UNSUPPORTED_URL_SCHEME",
      message: "URL scheme is not supported.",
    });
  });

  it("rejects localhost and private IP targets", async () => {
    const localhostResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "http://localhost:3000/health",
    });
    const localhostBody = await localhostResponse.json();

    assert.equal(localhostResponse.status, 400);
    assert.equal(localhostBody.code, "URL_NOT_ALLOWED");

    const privateIpResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "http://192.168.1.10/admin",
    });
    const privateIpBody = await privateIpResponse.json();

    assert.equal(privateIpResponse.status, 400);
    assert.equal(privateIpBody.code, "URL_NOT_ALLOWED");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/api/short-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{bad json",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      code: "INVALID_JSON",
      message: "Request body is invalid JSON.",
    });
  });

  it("redirects an existing short code and increments clickCount", async () => {
    const createdResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "https://example.com/articles/redirect-target",
    });
    const created = (await createdResponse.json()) as ShortLinkRecord;

    const redirectResponse = await fetch(`${baseUrl}/${created.shortCode}`, {
      redirect: "manual",
    });

    assert.equal(redirectResponse.status, 302);
    assert.equal(
      redirectResponse.headers.get("location"),
      "https://example.com/articles/redirect-target",
    );

    const saved = await repository.findByShortCode(created.shortCode);
    assert.equal(saved?.clickCount, 1);
  });

  it("returns 404 for a missing short code", async () => {
    const response = await fetch(`${baseUrl}/notExist123`, {
      redirect: "manual",
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      code: "SHORT_LINK_NOT_FOUND",
      message: "Short link was not found.",
    });
  });

  it("returns 400 for an invalid short code path", async () => {
    const response = await fetch(`${baseUrl}/bad-code!`, {
      redirect: "manual",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      code: "INVALID_SHORT_CODE",
      message: "Short code is invalid.",
    });
  });

  it("returns 410 for an expired short code", async () => {
    await seedRecords([
      {
        id: "expired-id",
        originalUrl: "https://example.com/expired",
        normalizedUrl: "https://example.com/expired",
        shortCode: "expired1",
        shortUrl: `${baseUrl}/expired1`,
        status: "active",
        clickCount: 0,
        expiresAt: "2020-01-01T00:00:00.000Z",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
    ]);

    const response = await fetch(`${baseUrl}/expired1`, {
      redirect: "manual",
    });
    const body = await response.json();
    const saved = await repository.findByShortCode("expired1");

    assert.equal(response.status, 410);
    assert.deepEqual(body, {
      code: "SHORT_LINK_EXPIRED",
      message: "Short link has expired.",
    });
    assert.equal(saved?.clickCount, 0);
  });

  async function seedRecords(records: ShortLinkRecord[]): Promise<void> {
    await writeFile(
      join(tempDir, "short-links.json"),
      `${JSON.stringify(records, null, 2)}\n`,
    );
  }
});

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
