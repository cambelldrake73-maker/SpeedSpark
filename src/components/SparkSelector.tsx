import React from 'react';
import { SPARK_SIGNAL_OPTIONS } from '../constants/options';
import { PrivateSignalSelector } from './PrivateSignalSelector';

interface SparkSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

/** Private spark signal — never displayed as a numeric score to users */
export function SparkSelector({ value, onChange }: SparkSelectorProps) {
  return (
    <PrivateSignalSelector
      title="Private spark signal"
      hint="Helps our internal match-fit model. Only you see this — never shown on your profile."
      options={SPARK_SIGNAL_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
