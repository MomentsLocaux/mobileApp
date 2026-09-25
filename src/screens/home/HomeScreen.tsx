import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BrandIcon } from '@/components/ui/BrandIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuestGateModal } from '@/components/auth/GuestGateModal';
import { ContextualHero } from '@/components/home/ContextualHero';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeLumiaProposals } from '@/components/home/HomeLumiaProposals';
import { LocalPulseCard } from '@/components/home/LocalPulseCard';
import { NearbyMomentsSection } from '@/components/home/NearbyMomentsSection';
import { NextMomentCard } from '@/components/home/NextMomentCard';
import { SocialSignalCard } from '@/components/home/SocialSignalCard';
import { EmptyState } from '@/components/ui';
import { features } from '@/config/features';
import { colors, spacing } from '@/constants/theme';
import { useLumiaTourTarget } from '@/hooks/useLumiaTourTarget';
import { useAccountIdentity } from '@/hooks/useAccountIdentity';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { CONTRIBUTION_FAB_STACK_SPACE } from '@/utils/contribution-fab';

const LocationGlyph = ({ size = 32 }: { size?: number }) => <BrandIcon name="pin" size={size} />;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = useHomeFeed();
  const { accountKind } = useAccountIdentity();
  const headerProfileTour = useLumiaTourTarget('headerProfile');
  const headerChatTour = useLumiaTourTarget(features.lumiaChat ? 'headerChat' : undefined);
  const headerNotificationsTour = useLumiaTourTarget('headerNotifications');

  return (
    <View style={styles.container}>
      <View style={{ marginTop: insets.top }}>
        <HomeHeader
          greeting={feed.greeting}
          avatarUrl={feed.profile?.avatar_url}
          displayName={feed.profile?.display_name}
          showLumia={feed.showLumia}
          unreadNotifications={feed.unreadNotifications}
          onSubmitSearch={feed.openSearch}
          onPressProfile={feed.openProfile}
          onPressLumia={() => router.push('/lumia-chat' as never)}
          onPressNotifications={feed.openNotifications}
          profileTour={headerProfileTour}
          lumiaTour={headerChatTour}
          notificationsTour={headerNotificationsTour}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.brand.secondary} />
        }
      >
        <View style={styles.stack}>
          <ContextualHero hero={feed.hero} />
          {feed.nextEvent ? (
            <NextMomentCard
              event={feed.nextEvent}
              distanceLabel={feed.distanceLabelFor(feed.nextEvent)}
              onPress={() => feed.openEvent(feed.nextEvent!)}
              onOpenAgenda={feed.openAgenda}
            />
          ) : null}
          {!feed.browseCenter ? <EmptyState
            icon={LocationGlyph}
            title={feed.locationLoading ? 'Choisis ton point de départ' : 'Où as-tu envie de sortir ?'}
            subtitle="Explore autour de ta position ou choisis un lieu sur la carte."
            ctaLabel="Rechercher un lieu"
            onCtaPress={feed.openSearch}
            secondaryCtaLabel={feed.locationLoading ? undefined : 'Utiliser ma position'}
            onSecondaryCtaPress={feed.requestPermission}
          /> : <NearbyMomentsSection
            slot={feed.slot}
            events={feed.rankedEvents}
            totalCount={feed.slotCount}
            complete={feed.complete}
            loading={feed.poolLoading}
            error={feed.poolError}
            zoneLabel={feed.zoneLabel}
            radiusKm={feed.browseRadiusKm}
            onRadiusChange={feed.setBrowseRadius}
            reasonFor={feed.reasonFor}
            pendingHearts={feed.pendingHearts}
            onRetry={feed.retry}
            distanceLabelFor={feed.distanceLabelFor}
            isHearted={feed.isHearted}
            canWiden={feed.canWiden}
            showNextDays
            onSlotChange={feed.setSlot}
            onPressEvent={feed.openEvent}
            onToggleHeart={(event) => void feed.toggleHeart(event)}
            onOpenMap={feed.openMapForSlot}
            onWiden={feed.widen}
            onNextDays={feed.showNextDays}
          />}
          {feed.pulse ? <LocalPulseCard pulse={feed.pulse} complete={feed.complete} onExplore={feed.openPulse} /> : null}
          {feed.socialSignal ? (
            <SocialSignalCard
              signal={feed.socialSignal}
              onPress={() => {
                const event = feed.poolEvents.find((item) => item.id === feed.socialSignal?.eventId);
                if (event) feed.openEvent(event);
              }}
            />
          ) : null}
          {accountKind === 'professionnel' ? null : (
            <HomeLumiaProposals onPress={feed.openProposals} />
          )}
        </View>
      </ScrollView>
      <GuestGateModal
        visible={feed.guestGateOpen}
        title={feed.guestGateTitle}
        onClose={feed.closeGuestGate}
        onSignUp={() => {
          feed.closeGuestGate();
          router.push('/auth/register' as never);
        }}
        onSignIn={() => {
          feed.closeGuestGate();
          router.push('/auth/login' as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.page,
  },
  content: {
    paddingBottom: spacing.xl * 3 + CONTRIBUTION_FAB_STACK_SPACE,
    gap: spacing.md,
  },
  stack: {
    gap: spacing.lg,
  },
});
