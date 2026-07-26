import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { profilesRouter } from "./profilesRouter";
import { listingsRouter } from "./listingsRouter";
import { offersRouter } from "./offersRouter";
import { importsRouter } from "./importsRouter";
import { messagesRouter } from "./messagesRouter";
import { dealsRouter } from "./dealsRouter";
import { developerRouter } from "./developerRouter";
import { foreclosuresRouter } from "./foreclosuresRouter";
import { notificationsRouter, verificationRouter } from "./notificationsRouter";
import { aiRouter } from "./aiRouter";
import { channelsRouter } from "./channelsRouter";
import { uploadsRouter } from "./uploadsRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  profile: profilesRouter,
  listings: listingsRouter,
  offers: offersRouter,
  imports: importsRouter,
  messages: messagesRouter,
  deals: dealsRouter,
  developer: developerRouter,
  foreclosures: foreclosuresRouter,
  notifications: notificationsRouter,
  verification: verificationRouter,
  ai: aiRouter,
  channels: channelsRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
