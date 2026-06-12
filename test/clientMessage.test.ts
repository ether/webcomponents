import { describe, expect, it, vi } from 'vitest';
import {
  createClientMessageHandler,
  extractClientMessagePayload,
} from '../src/collab/clientMessage.js';
import type {
  ClientMessageHandlerContext,
  CollabUserInfo,
} from '../src/collab/clientMessage.js';
import { EventBus } from '../src/editor/core/EventBus.js';
import type { EditorEvents } from '../src/editor/core/EventBus.js';

const MY_USER_ID = 'a.myAuthorId123';

const makeHarness = (myUserInfo: Partial<CollabUserInfo> = {}) => {
  const userInfo: CollabUserInfo = {
    userId: MY_USER_ID,
    name: null,
    colorId: '#ffcc00',
    ...myUserInfo,
  };
  const bus = new EventBus<EditorEvents>();
  const setMyUserName = vi.fn((name: string) => {
    userInfo.name = name;
  });
  const sendMessage = vi.fn();
  const context: ClientMessageHandlerContext = {
    getMyUserInfo: () => userInfo,
    setMyUserName,
    sendMessage,
    bus,
  };
  return {
    handler: createClientMessageHandler(context),
    userInfo,
    bus,
    setMyUserName,
    sendMessage,
  };
};

const suggestUserNamePayload = (overrides: Record<string, unknown> = {}) => ({
  type: 'suggestUserName',
  newName: 'Alice',
  unnamedId: MY_USER_ID,
  ...overrides,
});

describe('createClientMessageHandler', () => {
  describe('suggestUserName (receiving)', () => {
    it('adopts the suggested name and sends a USERINFO_UPDATE', () => {
      const { handler, setMyUserName, sendMessage } = makeHarness();

      const handled = handler.handleClientMessage(suggestUserNamePayload());

      expect(handled).toBe(true);
      expect(setMyUserName).toHaveBeenCalledExactlyOnceWith('Alice');
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith({
        type: 'USERINFO_UPDATE',
        userInfo: {
          userId: MY_USER_ID,
          name: 'Alice',
          colorId: '#ffcc00',
        },
      });
    });

    it('emits user:info:updated on the bus', () => {
      const { handler, bus } = makeHarness();
      const events: EditorEvents['user:info:updated'][] = [];
      bus.on('user:info:updated', (data) => events.push(data));

      handler.handleClientMessage(suggestUserNamePayload());

      expect(events).toEqual([
        { userId: MY_USER_ID, name: 'Alice', colorId: '#ffcc00' },
      ]);
    });

    it('ignores suggestions targeting another user', () => {
      const { handler, setMyUserName, sendMessage } = makeHarness();

      const handled = handler.handleClientMessage(
        suggestUserNamePayload({ unnamedId: 'a.someoneElse' }),
      );

      expect(handled).toBe(false);
      expect(setMyUserName).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores suggestions when the user already has a name', () => {
      const { handler, setMyUserName, sendMessage } = makeHarness({
        name: 'Bob',
      });

      const handled = handler.handleClientMessage(suggestUserNamePayload());

      expect(handled).toBe(false);
      expect(setMyUserName).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores suggestions with an empty newName', () => {
      const { handler, sendMessage } = makeHarness();

      const handled = handler.handleClientMessage(
        suggestUserNamePayload({ newName: '' }),
      );

      expect(handled).toBe(false);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('tolerance', () => {
    it('treats padoptions as a handled no-op', () => {
      const { handler, setMyUserName, sendMessage } = makeHarness();

      const handled = handler.handleClientMessage({
        type: 'padoptions',
        options: { view: { useMonospaceFont: true } },
        changedBy: 'a.someoneElse',
      });

      expect(handled).toBe(true);
      expect(setMyUserName).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores unknown payload types without throwing', () => {
      const { handler } = makeHarness();

      expect(handler.handleClientMessage({ type: 'someFutureType' })).toBe(false);
      expect(handler.handleClientMessage(null)).toBe(false);
      expect(handler.handleClientMessage('garbage')).toBe(false);
      expect(handler.handleClientMessage({ noType: true })).toBe(false);
    });
  });

  describe('handleFrame (wire format)', () => {
    it('handles the server relay frame end-to-end (socket.io-style array)', () => {
      const { handler, sendMessage } = makeHarness();

      // Exact shape relayed by the Go server's HandleClientMessage:
      // json.Marshal([]any{"message", message.Data})
      const frame = JSON.parse(JSON.stringify([
        'message',
        {
          component: 'pad',
          type: 'COLLABROOM',
          data: {
            type: 'CLIENT_MESSAGE',
            payload: { type: 'suggestUserName', newName: 'Alice', unnamedId: MY_USER_ID },
          },
        },
      ]));

      expect(handler.handleFrame(frame)).toBe(true);
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ type: 'USERINFO_UPDATE' }),
      );
    });

    it('handles the {event, data} object framing', () => {
      const { handler } = makeHarness();

      const frame = {
        event: 'message',
        data: {
          type: 'COLLABROOM',
          data: {
            type: 'CLIENT_MESSAGE',
            payload: { type: 'suggestUserName', newName: 'Alice', unnamedId: MY_USER_ID },
          },
        },
      };

      expect(handler.handleFrame(frame)).toBe(true);
    });

    it('ignores non-CLIENT_MESSAGE frames', () => {
      const { handler, sendMessage } = makeHarness();

      expect(handler.handleFrame(['message', { type: 'COLLABROOM', data: { type: 'USER_NEWINFO', userInfo: {} } }])).toBe(false);
      expect(handler.handleFrame(['somethingElse', {}])).toBe(false);
      expect(handler.handleFrame({ event: 'connect' })).toBe(false);
      expect(handler.handleFrame(undefined)).toBe(false);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});

describe('extractClientMessagePayload', () => {
  const payload = { type: 'suggestUserName', newName: 'Alice', unnamedId: MY_USER_ID };
  const collabRoom = {
    type: 'COLLABROOM',
    data: { type: 'CLIENT_MESSAGE', payload },
  };

  it('unwraps all supported framings', () => {
    expect(extractClientMessagePayload(['message', collabRoom])).toEqual(payload);
    expect(extractClientMessagePayload({ event: 'message', data: collabRoom })).toEqual(payload);
    expect(extractClientMessagePayload(collabRoom)).toEqual(payload);
    expect(extractClientMessagePayload(collabRoom.data)).toEqual(payload);
  });

  it('returns null for anything that is not a CLIENT_MESSAGE', () => {
    expect(extractClientMessagePayload(null)).toBe(null);
    expect(extractClientMessagePayload([])).toBe(null);
    expect(extractClientMessagePayload(['message'])).toBe(null);
    expect(extractClientMessagePayload({ type: 'COLLABROOM', data: { type: 'NEW_CHANGES' } })).toBe(null);
    expect(extractClientMessagePayload({ type: 'CLIENT_MESSAGE' })).toBe(null);
    expect(extractClientMessagePayload({ type: 'CLIENT_MESSAGE', payload: { noType: 1 } })).toBe(null);
  });
});
