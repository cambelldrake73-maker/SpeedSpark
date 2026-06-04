import type { Match, Message } from '../types';
import { MOCK_PARTNER, MOCK_QUEUE_USERS } from './mockUsers';

const MOCK_ALEX = MOCK_QUEUE_USERS[1];

export const MOCK_MATCHES: Match[] = [
  {
    id: 'match-1',
    user: MOCK_PARTNER,
    matchedAt: '2026-06-01T20:15:00',
    lastMessage: 'That speed date was so fun! Want to grab coffee this weekend?',
    lastMessageAt: '2026-06-01T21:30:00',
  },
  {
    id: 'match-2',
    user: MOCK_ALEX,
    matchedAt: '2026-05-28T19:00:00',
    lastMessage: "Sounds good — I'll send you the cafe name tomorrow.",
    lastMessageAt: '2026-05-29T10:12:00',
  },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    matchId: 'match-1',
    senderId: 'user-2',
    text: 'Hey! Great meeting you tonight — really enjoyed our chat.',
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
  {
    id: 'msg-4',
    matchId: 'match-2',
    senderId: 'user-3',
    text: 'Hi! Loved our speed date — want to meet up at a queer bookshop event?',
    sentAt: '2026-05-28T19:05:00',
  },
  {
    id: 'msg-5',
    matchId: 'match-2',
    senderId: 'user-1',
    text: 'Yes! That sounds perfect. What day works for you?',
    sentAt: '2026-05-28T19:20:00',
  },
  {
    id: 'msg-6',
    matchId: 'match-2',
    senderId: 'user-3',
    text: "Maybe Thursday evening? I can check what's on the calendar.",
    sentAt: '2026-05-29T09:45:00',
  },
  {
    id: 'msg-7',
    matchId: 'match-2',
    senderId: 'user-1',
    text: "Sounds good — I'll send you the cafe name tomorrow.",
    sentAt: '2026-05-29T10:12:00',
  },
];
