import { Alert } from 'react-native';

const AFTER_MODAL_MS = 400;

function alertAfterModal(title: string, message: string) {
  setTimeout(() => Alert.alert(title, message), AFTER_MODAL_MS);
}

export function askToConfirmReport(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      resolve(accepted);
    };
    setTimeout(() => {
      Alert.alert(
        'Signaler',
        question,
        [
          { text: 'Non', style: 'cancel', onPress: () => finish(false) },
          { text: 'Oui', onPress: () => finish(true) },
        ],
        { cancelable: true, onDismiss: () => finish(false) },
      );
    }, AFTER_MODAL_MS);
  });
}

export function confirmReportSubmitted(message: string) {
  alertAfterModal('Signalement envoyé', message);
}

export function confirmReportFailed() {
  alertAfterModal('Erreur', "Impossible d'envoyer le signalement pour le moment.");
}
