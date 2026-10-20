import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '../../src/screens/LessonScreen.tsx';

export default function Lesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LessonScreen key={id} id={id} />;
}
