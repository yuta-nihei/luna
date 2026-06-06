import { coreRequest } from "./core";

// Opens a URL in the user's default browser via the Go core (url.open). Only
// http/https URLs are accepted; the core rejects anything else.
export const urlService = {
  async open(url: string): Promise<void> {
    await coreRequest<{ ok: boolean }>("url.open", { url });
  },
};
