/**
 * Reads emails caught by the local Supabase Mailpit (http://127.0.0.1:54324).
 * Local only: hosted projects send real email.
 */
const MAILPIT = "http://127.0.0.1:54324/api/v1";

type Summary = { ID: string; To: { Address: string }[]; Created: string };

/** The newest email to `address`, waiting up to `timeoutMs` for it to arrive. */
export async function latestEmailTo(address: string, timeoutMs = 15_000): Promise<{ subject: string; html: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    if (!response.ok) throw new Error(`Mailpit search failed (${response.status}). Is \`npm run db:start\` running?`);
    const { messages } = (await response.json()) as { messages: Summary[] };
    if (messages.length > 0) {
      const newest = [...messages].sort((a, b) => b.Created.localeCompare(a.Created))[0];
      const message = (await (await fetch(`${MAILPIT}/message/${newest.ID}`)).json()) as { Subject: string; HTML: string };
      return { subject: message.Subject, html: message.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email to ${address} within ${timeoutMs} ms`);
}

/** The first link in an email whose text includes `linkText`. */
export function linkIn(html: string, linkText: string): string {
  for (const match of html.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (match[2].includes(linkText)) return match[1].replaceAll("&amp;", "&");
  }
  throw new Error(`No link "${linkText}" in the email`);
}
