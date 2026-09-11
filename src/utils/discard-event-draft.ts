import { Alert } from 'react-native';

export const DISCARD_EVENT_DRAFT_TITLE = 'Attention';
export const DISCARD_EVENT_DRAFT_MESSAGE = 'Vos changements seront perdus.';

export function confirmDiscardEventDraft(onConfirm: () => void) {
  Alert.alert(DISCARD_EVENT_DRAFT_TITLE, DISCARD_EVENT_DRAFT_MESSAGE, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Quitter', style: 'destructive', onPress: onConfirm },
  ]);
}
