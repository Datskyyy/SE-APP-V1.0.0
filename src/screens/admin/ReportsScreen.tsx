import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function ReportsScreen() {
  return (
    <GenericManagementScreen
      title="Reports"
      subtitle="Data overview for academics"
      actions={[
        { label: 'Total Users', table: 'users' },
        { label: 'Total Activities', table: 'activities' },
        { label: 'Total Progress Rows', table: 'progress' }
      ]}
    />
  );
}
