import { getShortLinkByCode } from "../src/api/getShortLinkByCode.js";
import { postShortLinks } from "../src/api/postShortLinks.js";
import { JsonShortLinkRepository } from "../src/shortLinkRepository.js";

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
