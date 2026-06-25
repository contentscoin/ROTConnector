/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as connections from "../connections.js";
import type * as contributions from "../contributions.js";
import type * as events from "../events.js";
import type * as matches from "../matches.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as notify from "../notify.js";
import type * as push from "../push.js";
import type * as requests from "../requests.js";
import type * as seed from "../seed.js";
import type * as util from "../util.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  audit: typeof audit;
  auth: typeof auth;
  connections: typeof connections;
  contributions: typeof contributions;
  events: typeof events;
  matches: typeof matches;
  members: typeof members;
  migrations: typeof migrations;
  notifications: typeof notifications;
  notify: typeof notify;
  push: typeof push;
  requests: typeof requests;
  seed: typeof seed;
  util: typeof util;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
