import { http, HttpResponse } from "msw";

// In-memory storage for blob mock
const blobStore = new Map<string, Buffer>();

// In-memory storage for email mock
export const sentEmails: Array<{
  to: string;
  subject: string;
  body: string;
}> = [];

export const handlers = [
  // Azure Blob Storage – PUT (upload)
  http.put("https://*.blob.core.windows.net/*", async ({ request }) => {
    const url = new URL(request.url);
    const body = await request.arrayBuffer();
    blobStore.set(url.pathname, Buffer.from(body));
    return new HttpResponse(null, { status: 201 });
  }),

  // Azure Blob Storage – GET (download)
  http.get("https://*.blob.core.windows.net/*", ({ request }) => {
    const url = new URL(request.url);
    const data = blobStore.get(url.pathname);
    if (!data) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(data, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }),

  // Azure Communication Services – send email
  http.post("https://*.communication.azure.com/emails*", async ({ request }) => {
    const body = (await request.json()) as {
      recipients: { to: Array<{ address: string }> };
      content: { subject: string; html?: string; plainText?: string };
    };
    sentEmails.push({
      to: body.recipients.to[0]?.address ?? "",
      subject: body.content.subject,
      body: body.content.html ?? body.content.plainText ?? "",
    });
    return HttpResponse.json({ id: `mock-email-${Date.now()}`, status: "Succeeded" });
  }),
];
