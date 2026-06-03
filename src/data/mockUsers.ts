import type { UserProfile } from '../types';

export const MOCK_CURRENT_USER: UserProfile = {
  id: 'user-1',
  name: '',
  age: 0,
  location: '',
  heightInches: 66,
  photos: [],
  genderIdentity: 'prefer_not_to_say',
  sexualOrientation: 'prefer_not_to_say',
  lookingFor: [],
  queerPreferences: [],
  personalityTags: [],
  verificationStatus: 'unverified',
};

export const MOCK_PARTNER: UserProfile = {
  id: 'user-2',
  name: 'Jordan',
  age: 28,
  location: 'Brooklyn, NY',
  heightInches: 67,
  photos: ['https://i.pravatar.cc/300?img=32'],
  genderIdentity: 'non_binary',
  sexualOrientation: 'queer',
  lookingFor: ['dates', 'relationship'],
  queerPreferences: ['verse', 'masc'],
  personalityTags: ['Creative', 'Foodie', 'Night owl'],
  verificationStatus: 'verified',
  attractivenessRating: 7,
};

export const MOCK_QUEUE_USERS: UserProfile[] = [
  MOCK_PARTNER,
  {
    id: 'user-3',
    name: 'Alex',
    age: 26,
    location: 'Manhattan, NY',
    heightInches: 64,
    photos: ['https://i.pravatar.cc/300?img=47'],
    genderIdentity: 'woman',
    sexualOrientation: 'lesbian',
    lookingFor: ['relationship'],
    queerPreferences: ['fem', 'no_label'],
    personalityTags: ['Bookworm', 'Activist'],
    verificationStatus: 'verified',
  },
  {
    id: 'user-4',
    name: 'Sam',
    age: 30,
    location: 'Queens, NY',
    heightInches: 70,
    photos: ['https://i.pravatar.cc/300?img=12'],
    genderIdentity: 'trans_man',
    sexualOrientation: 'gay',
    lookingFor: ['dates', 'friends'],
    queerPreferences: ['top', 'masc'],
    personalityTags: ['Outdoorsy', 'Dog person'],
    verificationStatus: 'verified',
  },
];
