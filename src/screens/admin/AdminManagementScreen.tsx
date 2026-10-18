import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function AdminManagementScreen() {
  return (
    <GenericManagementScreen
      title="Admin Management"
      subtitle="Manage academic data and users"
      actions={[
        { label: 'Users', table: 'users' },
        { label: 'Activities', table: 'activities' },
        { label: 'Generated Content', table: 'generated_content' }
      ]}
    />
  );
}
