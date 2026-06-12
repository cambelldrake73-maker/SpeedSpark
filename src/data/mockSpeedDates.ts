import type { SpeedDateWindow } from '../types';

export const MOCK_SPEED_DATE_WINDOWS: SpeedDateWindow[] = [
  {
    id: 'window-1',
    label: 'Weeknight Mix',
    description: '',
    startTime: '2026-06-02T19:00:00',
    endTime: '2026-06-02T21:00:00',
    timezone: 'America/New_York',
    isLive: true,
    queueCount: 12,
  },
  {
    id: 'window-2',
    label: 'Sunday Brunch Dates',
    description: 'Softer daytime energy — great for relationship-minded folks.',
    startTime: '2026-06-08T11:00:00',
    endTime: '2026-06-08T13:00:00',
    timezone: 'America/New_York',
    isLive: false,
    queueCount: 0,
  },
  {
    id: 'window-3',
    label: 'Late Night Connections',
    description: 'For night owls open to dates, casual hangouts, or new queer friends.',
    startTime: '2026-06-05T21:00:00',
    endTime: '2026-06-05T23:00:00',
    timezone: 'America/New_York',
    isLive: false,
    queueCount: 0,
  },
];

/** 5 minutes in production; 60s in dev for easier demos */
export const DATE_DURATION_SECONDS = __DEV__ ? 60 : 300;
