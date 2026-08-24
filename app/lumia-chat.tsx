import { Redirect } from 'expo-router';
import { features } from '@/config/features';
import LumiaChatScreen from '@/screens/lumia/LumiaChatScreen';

export default function LumiaChatRoute() {
  if (!features.lumiaChat) {
    return <Redirect href="/(tabs)" />;
  }
  return <LumiaChatScreen />;
}
