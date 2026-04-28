import { initBotId } from "botid/client/core";

/**
 * Vercel BotID — invisible bot detection, configured client-side via
 * `initBotId`. The list below names every route the BotID challenge
 * client should attach signed headers to. Server-side
 * `checkBotId()` calls only succeed for routes named here, so adding a
 * new protected surface means adding it here AND adding the
 * `checkBotId()` call in the action that handles it.
 *
 * Today we protect the curated-trip teaser submit. The form is a
 * Server Action invoked from `/curated/[slug]`, and Next.js routes
 * Server Actions back to the originating page URL — so the protected
 * path is the page itself, not the action's internal id.
 *
 * Local dev always classifies as `isBot: false` unless we override
 * `developmentOptions` on `checkBotId()`. See
 * https://vercel.com/docs/botid/local-development-behavior.
 */
initBotId({
  protect: [
    {
      path: "/curated/*",
      method: "POST",
    },
  ],
});
