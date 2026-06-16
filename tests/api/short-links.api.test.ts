import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe("string");
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

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("creates a short link and returns a shortUrl", async () => {
    const response = await postJson(`${baseUrl}/api/short-links`, {
      url: "https://example.com/articles/api-test",
    });
    const body = (await response.json()) as ShortLinkRecord;

    expect(response.status).toBe(201);
    expect(body.originalUrl).toBe("https://example.com/articles/api-test");
    expect(body.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(body.shortUrl).toBe(`${baseUrl}/${body.shortCode}`);
    expect(body.clickCount).toBe(0);

    const saved = await repository.findByShortCode(body.shortCode);
    expect(saved?.originalUrl).toBe("https://example.com/articles/api-test");
  });

  it("rejects unsupported URL schemes", async () => {
    const response = await postJson(`${baseUrl}/api/short-links`, {
      url: "javascript:alert(1)",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "UNSUPPORTED_URL_SCHEME",
      message: "URL scheme is not supported.",
    });
  });

  it("rejects localhost and private IP targets", async () => {
    const localhostResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "http://localhost:3000/health",
    });
    const localhostBody = await localhostResponse.json();

    expect(localhostResponse.status).toBe(400);
    expect(localhostBody.code).toBe("URL_NOT_ALLOWED");

    const privateIpResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "http://192.168.1.10/admin",
    });
    const privateIpBody = await privateIpResponse.json();

    expect(privateIpResponse.status).toBe(400);
    expect(privateIpBody.code).toBe("URL_NOT_ALLOWED");
  });

  it("returns 400 when url is missing or invalid", async () => {
    const missingUrlResponse = await postJson(`${baseUrl}/api/short-links`, {});
    const missingUrlBody = await missingUrlResponse.json();

    expect(missingUrlResponse.status).toBe(400);
    expect(missingUrlBody).toEqual({
      code: "URL_REQUIRED",
      message: "URL is required.",
    });

    const invalidUrlResponse = await postJson(`${baseUrl}/api/short-links`, {
      url: "not a url",
    });
    const invalidUrlBody = await invalidUrlResponse.json();

    expect(invalidUrlResponse.status).toBe(400);
    expect(invalidUrlBody).toEqual({
      code: "INVALID_URL",
      message: "URL is invalid.",
    });
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

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "INVALID_JSON",
      message: "Request body is invalid JSON.",
    });
  });

  it("returns 413 for oversized request bodies", async () => {
    const response = await fetch(`${baseUrl}/api/short-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "x".repeat(1024 * 32 + 1),
    });
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body).toEqual({
      code: "REQUEST_BODY_TOO_LARGE",
      message: "Request body is too large.",
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

    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("location")).toBe(
      "https://example.com/articles/redirect-target",
    );

    const saved = await repository.findByShortCode(created.shortCode);
    expect(saved?.clickCount).toBe(1);
  });

  it("returns 404 for a missing short code", async () => {
    const response = await fetch(`${baseUrl}/AbC123`, {
      redirect: "manual",
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      code: "SHORT_LINK_NOT_FOUND",
      message: "Short link was not found.",
    });
  });

  it("returns 400 for an invalid short code path", async () => {
    const response = await fetch(`${baseUrl}/bad-code!`, {
      redirect: "manual",
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "INVALID_SHORT_CODE",
      message: "Short code is invalid.",
    });

    const wrongLengthResponse = await fetch(`${baseUrl}/abcde`, {
      redirect: "manual",
    });
    const wrongLengthBody = await wrongLengthResponse.json();

    expect(wrongLengthResponse.status).toBe(400);
    expect(wrongLengthBody).toEqual({
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
        shortCode: "exp123",
        shortUrl: `${baseUrl}/exp123`,
        status: "active",
        clickCount: 0,
        expiresAt: "2020-01-01T00:00:00.000Z",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
    ]);

    const response = await fetch(`${baseUrl}/exp123`, {
      redirect: "manual",
    });
    const body = await response.json();
    const saved = await repository.findByShortCode("exp123");

    expect(response.status).toBe(410);
    expect(body).toEqual({
      code: "SHORT_LINK_EXPIRED",
      message: "Short link has expired.",
    });
    expect(saved?.clickCount).toBe(0);
  });

  it("returns 410 for a disabled short code", async () => {
    await seedRecords([
      {
        id: "disabled-id",
        originalUrl: "https://example.com/disabled",
        normalizedUrl: "https://example.com/disabled",
        shortCode: "dis123",
        shortUrl: `${baseUrl}/dis123`,
        status: "disabled",
        clickCount: 0,
        expiresAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await fetch(`${baseUrl}/dis123`, {
      redirect: "manual",
    });
    const body = await response.json();
    const saved = await repository.findByShortCode("dis123");

    expect(response.status).toBe(410);
    expect(body).toEqual({
      code: "SHORT_LINK_DISABLED",
      message: "Short link is disabled.",
    });
    expect(saved?.clickCount).toBe(0);
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
