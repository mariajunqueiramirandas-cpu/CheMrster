/** Files the learner takes out of the app (a backup, a drawing) or brings in (a backup), through Android's share sheet and file picker. */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes `text` to a file in the cache and opens the share sheet (Drive, e-mail, Arquivos…). */
export async function shareText(name: string, text: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não tem como compartilhar arquivos.');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** Lets the learner pick a JSON file; undefined when they cancel. */
export async function pickJson(): Promise<string | undefined> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return undefined;
  return new File(res.assets[0].uri).text();
}
