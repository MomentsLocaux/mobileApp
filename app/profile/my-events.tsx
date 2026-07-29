import { FeatureGate } from '@/components/FeatureGate';
import MyEventsScreen from '../../src/screens/profile/MyEventsScreen';

export default function MyEventsRoute() {
  return (
    <FeatureGate flag="eventCreate">
      <MyEventsScreen />
    </FeatureGate>
  );
}
