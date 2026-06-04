import React from 'react';
import { APPEARANCE_SIGNAL_OPTIONS } from '../constants/options';
import { PrivateSignalSelector } from './PrivateSignalSelector';

interface AppearanceSignalSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

/** Private appearance balance from post-date survey — never a public rating */
export function AppearanceSignalSelector({ value, onChange }: AppearanceSignalSelectorProps) {
  return (
    <PrivateSignalSelector
      title="Private appearance balance"
      hint="How attracted were you to them? This stays private and helps us match you thoughtfully — never shown on your profile or shared with them."
      options={APPEARANCE_SIGNAL_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
