import {
  JsonShortLinkRepository,
  getShortLinkByCode,
  postShortLinks,
} from "../src/short-links/index.js";

const repository = new JsonShortLinkRepository();

async function main(): Promise<void> {
  const createCases = [
    {
      name: "missing url",
      body: {},
    },
    {
      name: "invalid url",
      body: {
        url: "not-a-url",
      },
    },
    {
      name: "unsupported scheme",
      body: {
        url: "javascript:alert(1)",
      },
    },
    {
      name: "localhost is blocked",
      body: {
        url: "http://localhost:3000/health",
      },
    },
    {
      name: "private ip is blocked",
      body: {
        url: "http://192.168.1.10/admin",
      },
    },
  ];

  for (const item of createCases) {
    const response = await postShortLinks(
      {
        method: "POST",
        body: item.body,
      },
      {
        repository,
      },
    );

    console.log(item.name, response.status, response.body);
  }

  const missingCode = await getShortLinkByCode(
    {
      method: "GET",
      params: {
        code: "notExist123",
      },
    },
    {
      repository,
    },
  );

  console.log("missing short code", missingCode.status, describeResponse(missingCode));

  const invalidCode = await getShortLinkByCode(
    {
      method: "GET",
      params: {
        code: "bad-code!",
      },
    },
    {
      repository,
    },
  );

  console.log("invalid short code", invalidCode.status, describeResponse(invalidCode));
}

function describeResponse(
  response: Awaited<ReturnType<typeof getShortLinkByCode>>,
): unknown {
  if ("body" in response) {
    return response.body;
  }

  return response.headers;
}

void main();
