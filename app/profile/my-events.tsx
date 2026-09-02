import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import MyEventsScreen from '../../src/screens/profile/MyEventsScreen';

/** Organizer publications — hidden unless `eventCreate` is on. */
export default function MyEventsRoute() {
  if (!features.eventCreate) {
    return <Redirect href="/profile/my-suggestions" />;
  }
  return <MyEventsScreen />;
}
