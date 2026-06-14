import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ShortLinkRecord } from "../domain/shortLinkTypes.js";

export interface CreateShortLinkRecordInput {
  originalUrl: string;
  normalizedUrl: string;
  shortCode: string;
  shortUrl: string;
  now: string;
}

export interface ShortLinkRepository {
  existsByShortCode(shortCode: string): Promise<boolean>;
  findByShortCode(shortCode: string): Promise<ShortLinkRecord | null>;
  incrementVisitCount(shortCode: string, now: string): Promise<void>;
  create(input: CreateShortLinkRecordInput): Promise<ShortLinkRecord>;
}

export class JsonShortLinkRepository implements ShortLinkRepository {
  constructor(
    private readonly filePath = resolve(
      process.cwd(),
      "data",
      "short-links.json",
    ),
  ) {}

  async existsByShortCode(shortCode: string): Promise<boolean> {
    const records = await this.readRecords();
    return records.some((record) => record.shortCode === shortCode);
  }

  async findByShortCode(shortCode: string): Promise<ShortLinkRecord | null> {
    const records = await this.readRecords();
    return records.find((record) => record.shortCode === shortCode) ?? null;
  }

  async incrementVisitCount(shortCode: string, now: string): Promise<void> {
    const records = await this.readRecords();
    const record = records.find((item) => item.shortCode === shortCode);

    if (!record) {
      return;
    }

    record.clickCount += 1;
    record.updatedAt = now;
    await this.writeRecords(records);
  }

  async create(input: CreateShortLinkRecordInput): Promise<ShortLinkRecord> {
    const records = await this.readRecords();

    if (records.some((record) => record.shortCode === input.shortCode)) {
      throw new Error("Short code already exists.");
    }

    const record: ShortLinkRecord = {
      id: randomUUID(),
      originalUrl: input.originalUrl,
      normalizedUrl: input.normalizedUrl,
      shortCode: input.shortCode,
      shortUrl: input.shortUrl,
      status: "active",
      clickCount: 0,
      expiresAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    };

    records.push(record);
    await this.writeRecords(records);

    return record;
  }

  private async readRecords(): Promise<ShortLinkRecord[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return JSON.parse(content) as ShortLinkRecord[];
    } catch (error) {
      if (isFileNotFoundError(error)) {
        return [];
      }

      throw error;
    }
  }

  private async writeRecords(records: ShortLinkRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`);
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
