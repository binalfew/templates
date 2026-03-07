import { http, HttpResponse } from "msw";
import { requireHeader, writeEmail } from "./utils";

export const handlers = [
  // Resend API – send email
  http.post("https://api.resend.com/emails", async ({ request }) => {
    requireHeader(request.headers, "Authorization");
    const body = await request.json();
    console.info("mocked email contents:", body);

    const email = writeEmail(body);

    return HttpResponse.json({
      id: `mock-${Date.now()}`,
      from: email.from,
      to: email.to,
      created_at: new Date().toISOString(),
    });
  }),
];
