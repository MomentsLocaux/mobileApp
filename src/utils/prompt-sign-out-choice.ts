import { Alert } from 'react-native';
import { SIGN_OUT_CHOICE, type SignOutChoice } from '@/constants/sign-out-choice';

export function promptSignOutChoice(onChoose: (choice: SignOutChoice) => void): void {
  Alert.alert(SIGN_OUT_CHOICE.title, SIGN_OUT_CHOICE.message, [
    { text: SIGN_OUT_CHOICE.cancel, style: 'cancel' },
    { text: SIGN_OUT_CHOICE.keepDevice, onPress: () => onChoose('keep-device') },
    { text: SIGN_OUT_CHOICE.forgetDevice, style: 'destructive', onPress: () => onChoose('forget-device') },
  ]);
}
