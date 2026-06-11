/**
 * Collab CLIENT_MESSAGE handling — the client-side counterpart of the
 * server's COLLABROOM CLIENT_MESSAGE family.
 *
 * Mirrors the original Etherpad behavior (`pad.handleClientMessage` in
 * `pad.ts` / `pad_userlist.ts`):
 *
 *  - `suggestUserName`: another user typed a name suggestion for an unnamed
 *    user. When the suggestion targets *this* user and this user has no name
 *    yet, the suggested name is adopted locally and a `USERINFO_UPDATE` is
 *    sent back to the server so everyone else sees the new name.
 *  - `padoptions`: tolerated as a no-op (pad-wide settings are not supported
 *    on this stack; the server ignores them too).
 *  - any other payload type is ignored without throwing, so future server
 *    additions never break older clients.
 *
 * Wire format notes (verified against the etherpad-go stack):
 *  - server -> client frames are socket.io-style JSON arrays:
 *      ["message", {type: "COLLABROOM", data: {type: "CLIENT_MESSAGE", payload: {...}}}]
 *  - client -> server frames are JSON objects:
 *      {event: "message", data: {type: "COLLABROOM", ...}}
 * `extractClientMessagePayload` accepts both framings (and already-unwrapped
 * messages), so hosts can feed it whatever level of the stack they have.
 */

import { EventBus, editorBus } from '../editor/core/EventBus.js';
import type { EditorEvents } from '../editor/core/EventBus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal user info shape shared with the collab client. */
export interface CollabUserInfo {
  userId: string;
  name?: string | null;
  colorId?: string | number | null;
  [key: string]: unknown;
}

/** Payload of a `suggestUserName` CLIENT_MESSAGE. */
export interface SuggestUserNamePayload {
  type: 'suggestUserName';
  /** The suggested display name. */
  newName: string;
  /** The author id of the (still unnamed) user the suggestion targets. */
  unnamedId: string;
}

/** Payload of a `padoptions` CLIENT_MESSAGE (tolerated, not applied). */
export interface PadOptionsPayload {
  type: 'padoptions';
  options?: Record<string, unknown>;
  changedBy?: string;
}

/** Any CLIENT_MESSAGE payload — known types plus a tolerant fallback. */
export type ClientMessagePayload =
  | SuggestUserNamePayload
  | PadOptionsPayload
  | { type: string; [key: string]: unknown };

/** The `USERINFO_UPDATE` collab message sent after adopting a name. */
export interface UserInfoUpdateMessage {
  type: 'USERINFO_UPDATE';
  userInfo: CollabUserInfo;
}

/** Host integration points for the handler. */
export interface ClientMessageHandlerContext {
  /** Returns the local user's current info (id, name, colorId). */
  getMyUserInfo: () => CollabUserInfo;
  /** Adopts the suggested name locally (update state/UI). */
  setMyUserName: (name: string) => void;
  /**
   * Sends a collab message to the server (the host wraps it into its
   * COLLABROOM envelope, like `collabClient.sendMessage` does).
   */
  sendMessage: (msg: UserInfoUpdateMessage) => void;
  /** Event bus to announce the adopted name on. Defaults to `editorBus`. */
  bus?: EventBus<EditorEvents>;
}

export interface ClientMessageHandler {
  /**
   * Handles an unwrapped CLIENT_MESSAGE payload.
   * Returns `true` when the message was recognized and acted upon.
   * Never throws on unknown or malformed payloads.
   */
  handleClientMessage: (payload: unknown) => boolean;
  /**
   * Convenience: unwraps a raw frame / COLLABROOM message and handles it.
   * Returns `true` when a CLIENT_MESSAGE was found and acted upon.
   */
  handleFrame: (frame: unknown) => boolean;
}

// ---------------------------------------------------------------------------
// Frame unwrapping
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Extracts the CLIENT_MESSAGE payload from a parsed server message at any
 * wrapping level:
 *
 *  - socket.io-style array frame: `["message", {type: "COLLABROOM", ...}]`
 *  - object frame: `{event: "message", data: {type: "COLLABROOM", ...}}`
 *  - COLLABROOM message: `{type: "COLLABROOM", data: {type: "CLIENT_MESSAGE", payload}}`
 *  - collab message: `{type: "CLIENT_MESSAGE", payload}`
 *
 * Returns the payload, or `null` when the input is not a CLIENT_MESSAGE.
 */
export const extractClientMessagePayload = (
  frame: unknown,
): ClientMessagePayload | null => {
  let msg: unknown = frame;

  // ["message", data] (server -> client framing)
  if (Array.isArray(msg)) {
    if (msg[0] !== 'message') return null;
    msg = msg[1];
  }

  if (!isRecord(msg)) return null;

  // {event: "message", data: {...}} (client -> server framing)
  if (typeof msg.event === 'string') {
    if (msg.event !== 'message') return null;
    msg = msg.data;
    if (!isRecord(msg)) return null;
  }

  // {type: "COLLABROOM", data: {...}}
  if (msg.type === 'COLLABROOM') {
    msg = msg.data;
    if (!isRecord(msg)) return null;
  }

  // {type: "CLIENT_MESSAGE", payload: {...}}
  if (msg.type !== 'CLIENT_MESSAGE') return null;
  const payload = msg.payload;
  if (!isRecord(payload) || typeof payload.type !== 'string') return null;
  return payload as ClientMessagePayload;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Creates a CLIENT_MESSAGE handler bound to the host's collab integration
 * points. See the module docs for the behavior of each payload type.
 */
export const createClientMessageHandler = (
  context: ClientMessageHandlerContext,
): ClientMessageHandler => {
  const bus = context.bus ?? editorBus;

  const handleSuggestUserName = (payload: Record<string, unknown>): boolean => {
    const { newName, unnamedId } = payload;
    const myUserInfo = context.getMyUserInfo();
    // Mirror the original guard: only adopt suggestions that target this
    // user, carry a non-empty name, and only while this user is unnamed.
    if (
      typeof newName !== 'string' ||
      newName === '' ||
      unnamedId !== myUserInfo.userId ||
      myUserInfo.name
    ) {
      return false;
    }

    context.setMyUserName(newName);

    // Propagate the adopted name to the server (collabClient.updateUserInfo
    // equivalent) so all other clients learn the new name.
    const userInfo: CollabUserInfo = {
      ...myUserInfo,
      name: newName,
    };
    context.sendMessage({ type: 'USERINFO_UPDATE', userInfo });

    bus.emit('user:info:updated', {
      userId: myUserInfo.userId,
      name: newName,
      colorId:
        typeof myUserInfo.colorId === 'string' ? myUserInfo.colorId : undefined,
    });
    return true;
  };

  const handleClientMessage = (payload: unknown): boolean => {
    if (!isRecord(payload) || typeof payload.type !== 'string') return false;
    switch (payload.type) {
      case 'suggestUserName':
        return handleSuggestUserName(payload);
      case 'padoptions':
        // Tolerated no-op: pad-wide settings are not supported on this
        // stack (the server ignores them as well). Swallow silently so the
        // message never surfaces as an error.
        return true;
      default:
        // Unknown CLIENT_MESSAGE types are ignored without throwing.
        return false;
    }
  };

  const handleFrame = (frame: unknown): boolean => {
    const payload = extractClientMessagePayload(frame);
    if (payload === null) return false;
    return handleClientMessage(payload);
  };

  return { handleClientMessage, handleFrame };
};
