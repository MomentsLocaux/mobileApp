import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CalendarDays,
  Heart,
  Play,
  ThumbsDown,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import { getEventImageUrls, getHumanizedDate } from '@/utils/event-card-display';
import type { ProposalDecision, ProposalSession } from './proposal.types';

type Props = {
  sessions: ProposalSession[];
  selectedSessionId: string | null;
  busyEventId: string | null;
  deleteBusy: boolean;
  onBack: () => void;
  onSelectSession: (sessionId: string | null) => void;
  onResume: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteAll: () => void;
  onRevise: (sessionId: string, eventId: string, decision: ProposalDecision) => void;
  onOpenDetails: (eventId: string) => void;
};

export function ProposalHistory({
  sessions,
  selectedSessionId,
  busyEventId,
  deleteBusy,
  onBack,
  onSelectSession,
  onResume,
  onDeleteSession,
  onDeleteAll,
  onRevise,
  onOpenDetails,
}: Props) {
  const insets = useSafeAreaInsets();
  const selectedSession = selectedSessionId
    ? sessions.find((session) => session.id === selectedSessionId)
    : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => selectedSession ? onSelectSession(null) : onBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={22} color={colors.brand.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PROPOSITIONS</Text>
          <Text style={styles.headerTitle}>{selectedSession ? 'Choix de la session' : 'Mon historique'}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => selectedSession ? onDeleteSession(selectedSession.id) : onDeleteAll()}
          disabled={deleteBusy || sessions.length === 0}
          accessibilityRole="button"
          accessibilityLabel={selectedSession ? 'Supprimer cette session' : 'Supprimer tout l’historique'}
        >
          {deleteBusy ? (
            <ActivityIndicator size="small" color="#fb7185" />
          ) : (
            <Trash2 size={20} color="#fb7185" />
          )}
        </TouchableOpacity>
      </View>

      {selectedSession ? (
        <SessionDetails
          session={selectedSession}
          busyEventId={busyEventId}
          onResume={onResume}
          onDelete={() => onDeleteSession(selectedSession.id)}
          deleteBusy={deleteBusy}
          onRevise={onRevise}
          onOpenDetails={onOpenDetails}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.sessionsContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.introText}>
            Retrouve les événements proposés et corrige un choix si tu changes d’avis.
          </Text>
          {sessions.map((session) => {
            const likes = session.decisions.filter((item) => item.decision === 'like').length;
            const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(session.createdAt));
            return (
              <View key={session.id} style={styles.sessionCard}>
                <TouchableOpacity
                  style={styles.sessionMain}
                  onPress={() => onSelectSession(session.id)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <View style={styles.sessionTopRow}>
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionTitle}>{session.preferences.anchor?.label || 'Sélection locale'}</Text>
                      <Text style={styles.sessionDate}>{date} · {session.preferences.radiusKm} km</Text>
                    </View>
                    <View style={[styles.statusPill, session.status === 'completed' && styles.statusPillCompleted]}>
                      <Text style={styles.statusText}>{session.status === 'completed' ? 'Terminée' : 'En cours'}</Text>
                    </View>
                  </View>
                  <View style={styles.sessionStats}>
                    <Text style={styles.sessionStat}>{session.decisions.length}/{session.pool.length} choix</Text>
                    <Text style={styles.sessionStat}>❤️ {likes}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sessionDeleteButton}
                  onPress={() => onDeleteSession(session.id)}
                  disabled={deleteBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la session du ${date}`}
                >
                  <Trash2 size={18} color="#fb7185" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function SessionDetails({
  session,
  busyEventId,
  onResume,
  onDelete,
  deleteBusy,
  onRevise,
  onOpenDetails,
}: {
  session: ProposalSession;
  busyEventId: string | null;
  onResume: (sessionId: string) => void;
  onDelete: () => void;
  deleteBusy: boolean;
  onRevise: (sessionId: string, eventId: string, decision: ProposalDecision) => void;
  onOpenDetails: (eventId: string) => void;
}) {
  const decisions = new Map(session.decisions.map((item) => [item.event.id, item.decision]));
  return (
    <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.detailsSummary}>
        {session.decisions.length} événement{session.decisions.length > 1 ? 's' : ''} évalué{session.decisions.length > 1 ? 's' : ''} sur {session.pool.length}.
      </Text>
      {session.status === 'in_progress' ? (
        <TouchableOpacity style={styles.resumeButton} onPress={() => onResume(session.id)}>
          <Play size={18} color={colors.brand.primary} fill={colors.brand.primary} />
          <Text style={styles.resumeButtonText}>Reprendre cette session</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.deleteSessionButton}
        onPress={onDelete}
        disabled={deleteBusy}
        accessibilityRole="button"
        accessibilityLabel="Supprimer cette session"
      >
        {deleteBusy ? (
          <ActivityIndicator size="small" color="#fb7185" />
        ) : (
          <Trash2 size={18} color="#fb7185" />
        )}
        <Text style={styles.deleteSessionText}>Supprimer cette session</Text>
      </TouchableOpacity>

      <View style={styles.eventList}>
        {session.pool.map((event, index) => {
          const decision = decisions.get(event.id);
          const image = getEventImageUrls(event)[0];
          const date = getHumanizedDate(event, { includeTime: false });
          const busy = busyEventId === event.id;
          return (
            <View key={event.id} style={[styles.eventCard, !decision && styles.eventCardPending]}>
              <TouchableOpacity
                style={styles.eventMain}
                onPress={() => onOpenDetails(event.id)}
                activeOpacity={0.82}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.eventImage} />
                ) : (
                  <View style={[styles.eventImage, styles.eventImageFallback]}>
                    <CalendarDays size={22} color={colors.brand.secondary} />
                  </View>
                )}
                <View style={styles.eventCopy}>
                  <Text style={styles.eventIndex}>PROPOSITION {index + 1}</Text>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.eventDate} numberOfLines={1}>{date.startLine}</Text>
                </View>
              </TouchableOpacity>

              {decision ? (
                <View style={styles.decisionRow}>
                  <TouchableOpacity
                    style={[styles.decisionButton, decision === 'pass' && styles.passButtonActive]}
                    onPress={() => onRevise(session.id, event.id, 'pass')}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: decision === 'pass' }}
                  >
                    <ThumbsDown size={17} color={decision === 'pass' ? '#451a1a' : '#fb7185'} />
                    <Text style={[styles.decisionText, decision === 'pass' && styles.passTextActive]}>Je passe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.decisionButton, decision === 'like' && styles.likeButtonActive]}
                    onPress={() => onRevise(session.id, event.id, 'like')}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: decision === 'like' }}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.brand.secondary} />
                    ) : (
                      <Heart size={18} color={decision === 'like' ? '#052d21' : '#34d399'} fill={decision === 'like' ? '#052d21' : 'transparent'} />
                    )}
                    <Text style={[styles.decisionText, decision === 'like' && styles.likeTextActive]}>Coup de cœur</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.pendingText}>Pas encore présentée</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.surface },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerAction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(251, 113, 133, 0.10)' },
  eyebrow: { ...typography.label, fontSize: 10, letterSpacing: 1.1, color: colors.brand.secondary },
  headerTitle: { ...typography.h4, color: colors.brand.text },
  sessionsContent: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },
  introText: { ...typography.body, color: colors.brand.textSecondary, marginBottom: spacing.sm },
  sessionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  sessionMain: { flex: 1, padding: spacing.lg },
  sessionDeleteButton: { width: 48, height: 48, marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.full, backgroundColor: 'rgba(251, 113, 133, 0.10)' },
  sessionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  sessionCopy: { flex: 1 },
  sessionTitle: { ...typography.h5, color: colors.brand.text },
  sessionDate: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: 3 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: 'rgba(251, 191, 36, 0.14)' },
  statusPillCompleted: { backgroundColor: 'rgba(52, 211, 153, 0.14)' },
  statusText: { ...typography.label, fontSize: 10, color: colors.brand.text },
  sessionStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  sessionStat: { ...typography.bodySmall, color: colors.brand.textSecondary },
  detailsContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  detailsSummary: { ...typography.body, color: colors.brand.textSecondary },
  resumeButton: { minHeight: 50, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.brand.secondary },
  resumeButtonText: { ...typography.bodyBold, color: colors.brand.primary },
  deleteSessionButton: { minHeight: 48, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.45)' },
  deleteSessionText: { ...typography.bodyBold, color: '#fb7185' },
  eventList: { gap: spacing.md, marginTop: spacing.lg },
  eventCard: { overflow: 'hidden', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#334155', backgroundColor: colors.brand.surface },
  eventCardPending: { opacity: 0.66 },
  eventMain: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm },
  eventImage: { width: 72, height: 72, borderRadius: borderRadius.md, backgroundColor: '#243136' },
  eventImageFallback: { alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1, marginLeft: spacing.md },
  eventIndex: { ...typography.label, fontSize: 9, letterSpacing: 0.8, color: colors.brand.secondary },
  eventTitle: { ...typography.h6, color: colors.brand.text, marginTop: 2 },
  eventDate: { ...typography.bodySmall, color: colors.brand.textSecondary, marginTop: 3 },
  decisionRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, paddingTop: 0 },
  decisionButton: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#475569' },
  passButtonActive: { backgroundColor: '#fda4af', borderColor: '#fda4af' },
  likeButtonActive: { backgroundColor: '#6ee7b7', borderColor: '#6ee7b7' },
  decisionText: { ...typography.label, fontSize: 11, color: colors.brand.textSecondary },
  passTextActive: { color: '#451a1a' },
  likeTextActive: { color: '#052d21' },
  pendingText: { ...typography.bodySmall, color: colors.brand.textSecondary, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
