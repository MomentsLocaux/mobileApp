import { FeatureGate } from '@/components/FeatureGate';
import DiffuseurAnalyticsScreen from '@/screens/diffuseur/DiffuseurAnalyticsScreen';

export default function DiffuseurAnalyticsRoute() {
  return (
    <FeatureGate flag="diffuseur">
      <DiffuseurAnalyticsScreen />
    </FeatureGate>
  );
}
