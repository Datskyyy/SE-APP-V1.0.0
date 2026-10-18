import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, shadows } from '../constants/theme';

export function AppCard({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.card
  }
});
