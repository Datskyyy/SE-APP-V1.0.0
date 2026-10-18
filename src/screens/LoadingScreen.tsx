import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function LoadingScreen() {
  return (
    <LinearGradient colors={['#6D35C9', '#9D5CF8']} style={styles.container}>
      <Text style={styles.logo}>EduFile</Text>
      <ActivityIndicator color="#fff" size="large" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logo: { color: '#fff', fontWeight: '800', fontSize: 42 }
});
