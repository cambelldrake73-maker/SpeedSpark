import type { Match, Message } from '../types';
import { MOCK_PARTNER } from './mockUsers';

export const MOCK_MATCHES: Match[] = [
  {
    id: 'match-1',
    user: MOCK_PARTNER,
    matchedAt: '2026-06-01T20:15:00',
    lastMessage: 'That speed date was so fun! Want to grab coffee this weekend?',
    lastMessageAt: '2026-06-01T21:30:00',
  },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    matchId: 'match-1',
    senderId: 'user-2',
    text: 'Hey! Great meeting you tonight 🌈',
    sentAt: '2026-06-01T20:16:00',
  },
  {
    id: 'msg-2',
    matchId: 'match-1',
    senderId: 'user-1',
    text: 'You too! I loved hearing about your pottery class.',
    sentAt: '2026-06-01T20:18:00',
  },
  {
    id: 'msg-3',
    matchId: 'match-1',
    senderId: 'user-2',
    text: 'That speed date was so fun! Want to grab coffee this weekend?',
    sentAt: '2026-06-01T21:30:00',
  },
];
