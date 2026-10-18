import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { colors, shadows } from '../constants/theme';
import { LoadingScreen } from '../screens/LoadingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { DashboardScreen } from '../screens/tabs/DashboardScreen';
import { BrowseFilesScreen } from '../screens/tabs/BrowseFilesScreen';
import { LibraryScreen } from '../screens/tabs/LibraryScreen';
import { GenerateScreen } from '../screens/tabs/GenerateScreen';
import { InsightsScreen } from '../screens/tabs/InsightsScreen';
import { ProfileScreen } from '../screens/tabs/ProfileScreen';
import { FlashcardsScreen } from '../screens/tabs/FlashcardsScreen';
import { MCQScreen } from '../screens/tabs/MCQScreen';
import { TrueFalseScreen } from '../screens/tabs/TrueFalseScreen';
import { IdentificationScreen } from '../screens/tabs/IdentificationScreen';
import { StudyResultScreen } from '../screens/tabs/StudyResultScreen';
import { AdminManagementScreen } from '../screens/admin/AdminManagementScreen';
import { TeacherManagementScreen } from '../screens/teacher/TeacherManagementScreen';
import { StudentRecordsScreen } from '../screens/student/StudentRecordsScreen';
import { AttendanceScreen } from '../screens/teacher/AttendanceScreen';
import { GradesScreen } from '../screens/teacher/GradesScreen';
import { AnnouncementsScreen } from '../screens/admin/AnnouncementsScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function GenerateFAB({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fab}>
      <Ionicons name="add" size={28} color="#fff" />
    </Pressable>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Library: 'folder-open-outline',
            Generate: 'add-circle-outline',
            Progress: 'bar-chart-outline',
            Profile: 'person-outline'
          };

          if (route.name === 'Generate') {
            return <GenerateFAB onPress={() => navigation.navigate('Generate')} />;
          }

          return <Ionicons name={iconMap[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9d98ab'
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Generate" component={GenerateScreen} options={{ tabBarLabel: '' }} />
      <Tab.Screen name="Progress" component={InsightsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen name="BrowseFiles" component={BrowseFilesScreen} />
          <Stack.Screen name="StudyResult" component={StudyResultScreen} />
          <Stack.Screen name="Flashcards" component={FlashcardsScreen} />
          <Stack.Screen name="MCQ" component={MCQScreen} />
          <Stack.Screen name="TrueFalse" component={TrueFalseScreen} />
          <Stack.Screen name="Identification" component={IdentificationScreen} />
          <Stack.Screen name="AdminManagement" component={AdminManagementScreen} />
          <Stack.Screen name="TeacherManagement" component={TeacherManagementScreen} />
          <Stack.Screen name="StudentRecords" component={StudentRecordsScreen} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} />
          <Stack.Screen name="Grades" component={GradesScreen} />
          <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    height: 66,
    borderTopWidth: 0,
    paddingTop: 8,
    ...shadows.card
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
    ...shadows.card
  }
});
