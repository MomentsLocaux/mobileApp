import { Redirect } from 'expo-router';

export default function LegacyCreateStepRedirect() {
  return <Redirect href="/events/create/step-1" />;
}
