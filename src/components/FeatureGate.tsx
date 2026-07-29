import { Redirect } from 'expo-router';
import { features, type FeatureFlag } from '@/config/features';

type Props = {
  flag: FeatureFlag;
  children: React.ReactNode;
  /** Where to send users when the flag is off (default: map). */
  href?: string;
};

/**
 * Route-level gate: keep screens in the tree, redirect when the feature is off.
 */
export function FeatureGate({ flag, children, href = '/(tabs)/map' }: Props) {
  if (!features[flag]) {
    return <Redirect href={href as any} />;
  }
  return <>{children}</>;
}
