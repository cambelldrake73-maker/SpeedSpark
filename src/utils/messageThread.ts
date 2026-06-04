import type { Message } from '../types';

export type MessageTurn = 'yours' | 'theirs';

export interface MessageThreadMeta {
  turn: MessageTurn | null;
  hasUnread: boolean;
  lastMessage?: Message;
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
