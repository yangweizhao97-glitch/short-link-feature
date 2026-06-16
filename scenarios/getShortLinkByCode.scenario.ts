import {
  JsonShortLinkRepository,
  getShortLinkByCode,
  postShortLinks,
} from "../src/short-links/index.js";

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
    console.log("Create failed:", created);
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

  console.log("Redirect response:", response);
}

void main();
