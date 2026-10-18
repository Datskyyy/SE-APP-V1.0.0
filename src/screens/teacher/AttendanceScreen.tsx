import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function AttendanceScreen() {
  return (
    <GenericManagementScreen
      title="Attendance"
      subtitle="Daily attendance tracking"
      actions={[
        { label: 'Daily Activities', table: 'activities' },
        { label: 'Current Streaks', table: 'streaks' },
        { label: 'Progress Profiles', table: 'progress' }
      ]}
    />
  );
}
