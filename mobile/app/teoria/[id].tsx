import { useLocalSearchParams } from 'expo-router';
import { TheoryScreen } from '../../src/screens/TheoryScreen.tsx';

export default function Theory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TheoryScreen key={id} id={id} />;
}
