import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * OpenNext-Konfiguration für Cloudflare Workers.
 *
 * Die Seite nutzt aktuell kein ISR und kein `revalidatePath`/`revalidateTag`,
 * deshalb reicht der schreibgeschützte Cache auf Basis der Static Assets
 * (kein R2-Bucket, keine Durable Objects nötig): Vorgerenderte Seiten werden
 * beim Build mit ausgeliefert, alles andere wird pro Request gerendert.
 *
 * Sobald ISR/On-Demand-Revalidierung dazukommt, auf R2 + DO-Queue umstellen:
 *
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
 *
 *   export default defineCloudflareConfig({
 *     incrementalCache: r2IncrementalCache,
 *     queue: doQueue,
 *   });
 *
 * Dann zusätzlich in `wrangler.jsonc` den R2-Bucket (NEXT_INC_CACHE_R2_BUCKET)
 * und die Durable Objects (NEXT_CACHE_DO_QUEUE) inkl. `migrations` eintragen –
 * siehe https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
