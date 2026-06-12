export type LegalDocumentId = 'privacy' | 'help' | 'terms' | 'community';

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  subtitle?: string;
  sections: LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy',
    subtitle: 'What we collect, what stays private, and what you control.',
    sections: [
      {
        title: 'Profile information',
        body:
          'We store what you add to your profile — photos, name, age, location label, identity tags, and preferences — so we can show you to compatible matches and run speed dates.',
      },
      {
        title: 'What other members see',
        body:
          'Matches see your profile details and photos. During a live window, queued members may be paired with you for a timed call. Your exact GPS coordinates, phone number, and email are never shown on your profile.',
      },
      {
        title: 'Private signals',
        body:
          'Post-date attractiveness ratings, internal match-fit scores, and “would you talk again” choices are private. They help us improve pairing but are never displayed to other users or on your profile.',
      },
      {
        title: 'Location',
        body:
          'We use location to estimate distance for matching. We show a city or neighborhood label — not your precise address or live location on a map.',
      },
      {
        title: 'Messages & calls',
        body:
          'Messages between mutual matches are stored so conversations can continue. Live video during speed dates is real-time; recording by users is not permitted. Reports and blocks are logged for safety review.',
      },
      {
        title: 'Notifications',
        body:
          'Push notifications for messages and live events are managed in your device settings. In the app, open Settings → Enable notifications to allow alerts or open iOS/Android system settings.',
      },
      {
        title: 'Your controls',
        body:
          'You can update your profile, block users, unmatch, delete your account, and request data removal. Account deletion permanently removes your profile, matches, and messages in production.',
      },
    ],
  },
  help: {
    id: 'help',
    title: 'Help center',
    subtitle: 'Quick answers for getting started and staying safe.',
    sections: [
      {
        title: 'How speed dates work',
        body:
          'Join a live window from the lobby during scheduled times. You’ll enter a queue, get paired for a 5-minute video call, then fill out private feedback. If you both choose to match, messaging opens.',
      },
      {
        title: 'Matching & messaging',
        body:
          'A mutual match happens when both people say yes after a date. You’ll see “Your turn” or “Their turn” in messages depending on who sent the last message. Unread chats are highlighted so new messages stand out.',
      },
      {
        title: 'Safety tools',
        body:
          'During a call: mute, end early, report, or block. In messages: report, unmatch, or block from the menu. Blocked people can’t message you or be matched with you again. Manage blocked users in Settings.',
      },
      {
        title: 'Verification',
        body:
          'Verified profiles help keep the community trustworthy. Identity verification is rolling out — the demo may skip full checks, but real verification will be required for live windows.',
      },
      {
        title: 'Account & login',
        body:
          'Sign up with phone or email plus password. You can manage profile details, match preferences, notifications, and delete your account from Settings.',
      },
      {
        title: 'Contact support',
        body:
          'Email support@speedspark.app for account help, safety concerns, or accessibility requests. For urgent safety issues during a live call, end the date and block the person immediately.',
      },
    ],
  },
  terms: {
    id: 'terms',
    title: 'Terms of service',
    subtitle: 'The agreement between you and SpeedSpark.',
    sections: [
      {
        title: 'Eligibility',
        body:
          'You must be at least 18 years old to use SpeedSpark. By creating an account, you confirm you meet this requirement and that the information you provide is accurate.',
      },
      {
        title: 'Your account',
        body:
          'Keep your login secure. You are responsible for activity on your account. One person per account — no impersonation or sharing accounts.',
      },
      {
        title: 'Acceptable use',
        body:
          'Use SpeedSpark for genuine connection. Do not harass, threaten, discriminate, spam, scrape data, or attempt to circumvent safety features. We may suspend or remove accounts that violate these terms.',
      },
      {
        title: 'Live video & consent',
        body:
          'Speed dates are live video interactions. You may leave at any time. Do not record, screenshot, or redistribute calls or private messages without consent.',
      },
      {
        title: 'Content you share',
        body:
          'You own your photos and profile content, but grant SpeedSpark a license to display it within the app for matching and dating purposes. Do not upload content you do not have rights to share.',
      },
      {
        title: 'Service changes',
        body:
          'SpeedSpark is under active development. Features, live windows, and availability may change. This MVP demo may use mock data and placeholder flows.',
      },
      {
        title: 'Disclaimer',
        body:
          'SpeedSpark does not conduct background checks. We cannot guarantee user behavior. Use your judgment, meet in public when transitioning offline, and report concerns promptly.',
      },
    ],
  },
  community: {
    id: 'community',
    title: 'Community guidelines',
    subtitle: 'How we keep SpeedSpark queer, kind, and safe.',
    sections: [
      {
        title: 'Respect & inclusion',
        body:
          'SpeedSpark is built for queer people and allies who show up authentically. Respect pronouns, identities, boundaries, and differences in how people date.',
      },
      {
        title: 'Honesty',
        body:
          'Use recent photos and accurate basics. Misleading profiles waste everyone’s limited speed date time.',
      },
      {
        title: 'Consent first',
        body:
          'No means no — during calls, in messages, and when making plans. Do not pressure anyone to stay on a call, share contact info, or meet up.',
      },
      {
        title: 'Zero tolerance',
        body:
          'Harassment, hate speech, slurs, fetishization, threats, doxing, non-consensual imagery, and discrimination are not allowed. Violations can lead to immediate removal.',
      },
      {
        title: 'Keep it appropriate',
        body:
          'Speed dates are timed introductions — not explicit content channels. Sexual harassment or nudity during calls will result in a report review and possible ban.',
      },
      {
        title: 'Report & block',
        body:
          'If something feels off, report it and block the person. You never owe anyone an explanation for leaving a call or ending a chat.',
      },
      {
        title: 'Consequences',
        body:
          'We review reports, may warn or ban accounts, and may share information with law enforcement when required. Repeat or severe violations result in permanent removal.',
      },
    ],
  },
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return LEGAL_DOCUMENTS[id];
}
