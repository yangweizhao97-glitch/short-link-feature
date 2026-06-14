import { postShortLinks } from "../src/api/postShortLinks.js";

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

  console.log(response.status);
  console.log(response.body);
}

void main();
