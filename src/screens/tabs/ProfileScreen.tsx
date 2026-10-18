import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard } from '../../components/AppCard';
import { colors, radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';

const PURPLE = colors.primary;

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [darkTheme, setDarkTheme] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.title}>Profile</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="person-outline" size={21} color={PURPLE} />
          </View>
        </View>

        <AppCard style={styles.identityCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={30} color={PURPLE} />
          </View>
          <View style={styles.identityCopy}>
            <Text numberOfLines={1} style={styles.username}>{user?.fullName || 'Username'}</Text>
            <Text numberOfLines={1} style={styles.email}>{user?.email || 'Example@gmail.com'}</Text>
          </View>
          <Pressable style={styles.cameraBadge} accessibilityLabel="Edit profile photo">
            <Ionicons name="camera-outline" size={15} color="#fff" />
          </Pressable>
        </AppCard>

        <AppCard style={styles.menuCard}>
          <MenuRow icon="person-outline" label="Profile Details" />
          <MenuRow icon="lock-closed-outline" label="Security" />
        </AppCard>

        <AppCard style={styles.menuCard}>
          <MenuRow icon="settings-outline" label="Settings" />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="contrast-outline" size={21} color={colors.text} />
              <Text style={styles.rowText}>Dark Theme</Text>
            </View>
            <Switch
              value={darkTheme}
              onValueChange={setDarkTheme}
              trackColor={{ false: colors.border, true: PURPLE }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>
        </AppCard>

        <AppCard style={styles.menuCard}>
          <MenuRow icon="information-circle-outline" label="About us" />
        </AppCard>

        <Pressable style={styles.logoutRow} onPress={handleLogout} accessibilityRole="button">
          <View style={styles.rowLeft}>
            <Ionicons name="log-out-outline" size={21} color={colors.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.danger} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <Pressable style={styles.row} accessibilityRole="button">
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={21} color={colors.text} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    padding: 18,
    paddingBottom: 112,
    gap: 14,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F2EAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  username: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  email: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 4,
  },
  cameraBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  logoutRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  logoutText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
