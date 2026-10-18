import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '../../components/ScreenLayout';
import { AppCard } from '../../components/AppCard';
import { useAuth } from '../../hooks/useAuth';
import { appService } from '../../services/appService';
import { colors } from '../../constants/theme';

export function FlashcardsScreen() {
  const { user } = useAuth();
  const [cards, setCards] = useState<Array<{ front: string; back: string }>>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        if (!user?.id) return;
        setLoading(true);
        const latest = await appService.getLatestByType(user.id, 'flashcards');
        if (latest?.content) {
          try {
            setCards(JSON.parse(latest.content));
          } catch {
            setCards([]);
          }
        }
        setLoading(false);
      };
      load();
    }, [user?.id])
  );

  return (
    <ScreenLayout title="Flashcards" subtitle="Review your latest generated card set">
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !cards.length ? <AppCard><Text style={styles.empty}>No flashcards yet. Generate one from the Generate tab.</Text></AppCard> : null}
      {cards.map((card, idx) => (
        <AppCard key={`${card.front}-${idx}`}>
          <Text style={styles.front}>Q: {card.front}</Text>
          <Text style={styles.back}>A: {card.back}</Text>
        </AppCard>
      ))}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  front: { fontWeight: '700', color: colors.text },
  back: { marginTop: 8, color: colors.mutedText },
  empty: { color: colors.mutedText }
});
