import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

interface ScreenLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
}

export function ScreenLayout({ title, subtitle, children, scroll = true }: ScreenLayoutProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.mutedText, marginTop: 4, fontSize: 13 },
  body: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 32, gap: 12 }
});
