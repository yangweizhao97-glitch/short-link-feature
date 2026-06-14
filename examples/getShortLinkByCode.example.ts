import { getShortLinkByCode } from "../src/short-links/handlers/redirectShortLink.js";
import { postShortLinks } from "../src/short-links/handlers/createShortLink.js";
import { JsonShortLinkRepository } from "../src/short-links/repositories/shortLinkRepository.js";

const repository = new JsonShortLinkRepository();

async function main(): Promise<void> {
  const created = await postShortLinks(
    {
      method: "POST",
      body: {
        url: "https://example.com/articles/123",
      },
    },
    {
      repository,
      shortLinkBaseUrl: "https://s.example.com",
    },
  );

  if (!("shortCode" in created.body)) {
    console.log(created);
    return;
  }

  const response = await getShortLinkByCode(
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

  console.log(response);
}

void main();
