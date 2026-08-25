import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import MyEventsScreen from '../../src/screens/profile/MyEventsScreen';

/** Accessible for organizers (eventCreate) and community suggestors (eventSuggest). */
export default function MyEventsRoute() {
  if (!features.eventCreate && !features.eventSuggest) {
    return <Redirect href="/(tabs)/map" />;
  }
  return <MyEventsScreen />;
}
