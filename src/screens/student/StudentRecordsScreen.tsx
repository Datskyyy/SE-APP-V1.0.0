import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function StudentRecordsScreen() {
  return (
    <GenericManagementScreen
      title="Student Records"
      subtitle="Profiles and enrollment data"
      actions={[
        { label: 'Profiles', table: 'users' },
        { label: 'Progress Entries', table: 'progress' },
        { label: 'Streak Records', table: 'streaks' }
      ]}
    />
  );
}
