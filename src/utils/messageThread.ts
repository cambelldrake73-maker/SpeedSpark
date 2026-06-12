import type { Match, Message } from '../types';

export type MessageTurn = 'yours' | 'theirs';

export interface MessageThreadMeta {
  turn: MessageTurn | null;
  hasUnread: boolean;
  lastMessage?: Message;
}

export const EMPTY_MATCH_PREVIEW = 'New match';

export function getMatchPreviewText(match: Match, messages: Message[]): string {
  const last = messages[messages.length - 1];
  if (last?.text) {
    return last.text;
  }
  if (match.lastMessage) {
    return match.lastMessage;
  }
  return EMPTY_MATCH_PREVIEW;
}

export function isEmptyMatchThread(messages: Message[], match: Match): boolean {
  return messages.length === 0 && !match.lastMessage;
}

export function getMessageThreadMeta(
  messages: Message[],
  currentUserId: string,
  lastReadAt?: string,
): MessageThreadMeta {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return { turn: null, hasUnread: false };
  }

  const turn: MessageTurn =
    lastMessage.senderId === currentUserId ? 'theirs' : 'yours';

  const hasUnread =
    lastMessage.senderId !== currentUserId &&
    (!lastReadAt || new Date(lastMessage.sentAt) > new Date(lastReadAt));

  return { turn, hasUnread, lastMessage };
}

export function groupMessagesByMatch(messages: Message[]): Record<string, Message[]> {
  return messages.reduce<Record<string, Message[]>>((acc, message) => {
    if (!acc[message.matchId]) {
      acc[message.matchId] = [];
    }
    acc[message.matchId].push(message);
    return acc;
  }, {});
}
