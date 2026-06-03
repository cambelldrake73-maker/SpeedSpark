import type { SpeedDateWindow } from '../types';

export const MOCK_SPEED_DATE_WINDOWS: SpeedDateWindow[] = [
  {
    id: 'window-1',
    label: 'Weeknight Queer Mix',
    startTime: '2026-06-02T19:00:00',
    endTime: '2026-06-02T21:00:00',
    timezone: 'America/New_York',
    isLive: true,
  },
  {
    id: 'window-2',
    label: 'Sunday Brunch Dates',
    startTime: '2026-06-08T11:00:00',
    endTime: '2026-06-08T13:00:00',
    timezone: 'America/New_York',
    isLive: false,
  },
  {
    id: 'window-3',
    label: 'Late Night Connections',
    startTime: '2026-06-05T21:00:00',
    endTime: '2026-06-05T23:00:00',
    timezone: 'America/New_York',
    isLive: false,
  },
];

export const DATE_DURATION_SECONDS = 300;
