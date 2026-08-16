/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SessionPayload } from "./lib/auth";

declare global {
  namespace App {
    interface Locals {
      user: SessionPayload | null;
    }
  }

  interface ImportMetaEnv {
    readonly DATABASE_URL: string;
    readonly JWT_SECRET: string;
    readonly SESSION_COOKIE_NAME?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
