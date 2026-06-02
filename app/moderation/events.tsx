import { Redirect } from 'expo-router';

export default function RestrictedAreaRedirect() {
  return <Redirect href="/(tabs)/map" />;
}
