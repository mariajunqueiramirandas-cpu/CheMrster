/** Sharing the day's squares: the system share sheet on the phone, the browser's (or the clipboard) on the web. */
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import { toast } from '../../../src/app/toast.ts';

export async function copy(text: string) {
  await Clipboard.setStringAsync(text);
  toast('Resultado copiado');
}

export async function share(text: string) {
  if (Platform.OS !== 'web') {
    await Share.share({ message: text }).catch(() => copy(text));
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      // Closing the share sheet is not a failure.
      if ((e as { name?: string })?.name === 'AbortError') return;
    }
  }
  await copy(text);
}
