import { useLocalSearchParams } from 'expo-router';
import { StudioScreen } from '../src/screens/StudioScreen.tsx';

export default function Studio() {
  const { smiles } = useLocalSearchParams<{ smiles?: string }>();
  return <StudioScreen initialSmiles={smiles} />;
}
