import React from 'react';
import { Redirect } from 'expo-router';
import { features } from '@/config/features';

type Props = {
  children: React.ReactNode;
};

/** Create form stack: allow when organizer create OR poster suggest flag is on. */
export function EventFormLayoutGate({ children }: Props) {
  if (!features.eventCreate && !features.eventSuggest) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <>{children}</>;
}
