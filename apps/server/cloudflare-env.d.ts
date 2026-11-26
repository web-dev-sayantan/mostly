import type { DevServerEnv, ServerEnv } from "@mostly/infra/alchemy.run";

// This file infers types for the cloudflare:workers environment from your Alchemy Worker.
// @see https://alchemy.run/cloudflare/compute/workers

export type CloudflareEnv = ServerEnv;
export type DevCloudflareEnv = DevServerEnv;

declare global {
  type Env = CloudflareEnv;
  type DevEnv = DevCloudflareEnv;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    export interface Env extends CloudflareEnv {}
  }
}
