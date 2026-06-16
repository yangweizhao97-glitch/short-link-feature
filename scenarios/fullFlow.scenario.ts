import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JsonShortLinkRepository,
  getShortLinkByCode,
  postShortLinks,
} from "../src/short-links/index.js";

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "short-link-example-"));
  const repository = new JsonShortLinkRepository(join(tempDir, "short-links.json"));

  try {
    const created = await postShortLinks(
      {
        method: "POST",
        body: {
          url: "https://example.com/articles/full-flow",
        },
      },
      {
        repository,
        shortLinkBaseUrl: "https://s.example.com",
      },
    );

    console.log("Create status:", created.status);
    console.log("Create body:", created.body);

    if (!("shortCode" in created.body)) {
      return;
    }

    const redirect = await getShortLinkByCode(
      {
        method: "GET",
        params: {
          code: created.body.shortCode,
        },
      },
      {
        repository,
      },
    );

    console.log("Redirect response:", redirect);

    const saved = await repository.findByShortCode(created.body.shortCode);
    console.log("Visit count after redirect:", saved?.clickCount);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

void main();
