/** Isolated review entry, outside Expo Router. No auth, location, push or backend. */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader } from '@/components/home/HomeHeader';
import { AnimatedBrandMark } from '@/components/ui/AnimatedBrandMark';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { BrandLogoSpinner } from '@/components/ui/BrandLogoSpinner';
import { BrandStartupScreen } from '@/components/ui/BrandStartupScreen';
import { brandFontAssets } from '@/constants/fonts';
import { colors, spacing, typography } from '@/constants/theme';
import { useColdStartPresentation } from '@/hooks/useColdStartPresentation';

const Tabs = createBottomTabNavigator();
const RemountReview = createContext(() => {});
function HomeReview() {
  const insets = useSafeAreaInsets();
  const remountReview = useContext(RemountReview);
  const [key, setKey] = useState(0);
  const [lastAction, setLastAction] = useState('');
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <HomeHeader key={key} greeting="Bonjour Camille" displayName="Camille" showLumia unreadNotifications={2}
        onSubmitSearch={() => setLastAction('Recherche ouverte')}
        onPressProfile={() => setLastAction('Profil ouvert')}
        onPressLumia={() => setLastAction('Lumia ouverte')}
        onPressNotifications={() => setLastAction('Notifications ouvertes')}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.kicker}>LES IDÉES DU JOUR</Text>
        <Text style={styles.heading}>Un détour près de chez vous ?</Text>
        <Text style={styles.copy}>Le contenu et les commandes restent accessibles pendant le tracé du logo.</Text>
        <View style={styles.divider} />
        <Text style={styles.subheading}>Parcours de vérification</Text>
        <Text style={styles.copy}>Changer d’onglet puis revenir : logo fixe. Remonter l’en-tête : logo fixe. Relancer le bundle : une nouvelle signature.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setKey(value => value + 1)}><Text style={styles.buttonText}>Remonter l’en-tête</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={remountReview}><Text style={styles.buttonText}>Remonter le cadre</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.copy}>{lastAction}</Text>
        <View style={styles.samples}>
          {[24, 36, 64, 96].map(size => <View key={size} style={styles.sample}><AnimatedBrandMark size={size} /><Text style={styles.caption}>{size} px</Text></View>)}
        </View>
        <Text style={styles.subheading}>Propositions · variante leaf</Text>
        <View style={styles.samples}>
          {[22, 28, 36].map(size => <BrandIcon key={size} name="proposals" size={size} />)}
          <BrandLogoSpinner size={64} />
        </View>
      </ScrollView>
    </View>
  );
}
function StartupReview() { return <BrandStartupScreen />; }
function OtherReview() { return <View style={styles.center}><Text style={styles.subheading}>Autre écran</Text><Text style={styles.copy}>Revenir sur Accueil ne relance pas la signature.</Text></View>; }
function NativeReview() {
  const [loaded, error] = useFonts(brandFontAssets);
  const coldStart = useColdStartPresentation();
  return (
    <SafeAreaProvider>
      {(!loaded && !error) || !coldStart.complete ? <BrandStartupScreen onLayout={coldStart.onLayout} fontsReady={loaded || !!error} /> : (
        <NavigationContainer>
          <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand.text, tabBarStyle: { backgroundColor: colors.brand.page }, tabBarIconStyle: { display: 'none' }, tabBarLabelStyle: { fontSize: 13 } }}>
            <Tabs.Screen name="Accueil" component={HomeReview} />
            <Tabs.Screen name="Autre" component={OtherReview} />
            <Tabs.Screen name="Démarrage" component={StartupReview} />
          </Tabs.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.brand.page },
  body: { padding: spacing.lg, gap: spacing.md },
  kicker: { ...typography.caption, color: colors.brand.textSecondary, letterSpacing: 1.5 },
  heading: { ...typography.h3, color: colors.brand.text },
  subheading: { ...typography.h5, color: colors.brand.text },
  copy: { ...typography.bodySmall, color: colors.brand.textSecondary },
  caption: { ...typography.caption, color: colors.brand.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.brand.line, marginVertical: spacing.sm },
  button: { minHeight: 48, padding: spacing.md, backgroundColor: colors.brand.secondary, borderRadius: 16, alignItems: 'center' },
  buttonText: { ...typography.label, color: colors.brand.onAccent },
  samples: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  sample: { alignItems: 'center', gap: spacing.sm },
  center: { flex: 1, backgroundColor: colors.brand.page, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
});

function ReviewHost() {
  const [version, setVersion] = useState(0);
  const remount = useCallback(() => setVersion(value => value + 1), []);
  return <RemountReview.Provider value={remount}><NativeReview key={version} /></RemountReview.Provider>;
}

if (Platform.OS === 'web') document.title = 'Brand Signature B — Native components review';
registerRootComponent(ReviewHost);
