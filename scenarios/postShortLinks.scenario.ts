import { postShortLinks } from "../src/short-links/index.js";

async function main(): Promise<void> {
  const response = await postShortLinks(
    {
      method: "POST",
      body: {
        url: "https://example.com/articles/123",
      },
    },
    {
      shortLinkBaseUrl: "https://s.example.com",
    },
  );

  console.log("Status:", response.status);
  console.log("Body:", response.body);
}

void main();
