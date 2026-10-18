import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function AnnouncementsScreen() {
  return (
    <GenericManagementScreen
      title="Announcements"
      subtitle="Post and monitor updates"
      actions={[
        { label: 'Users to Notify', table: 'users' },
        { label: 'Recent Activities', table: 'activities' },
        { label: 'New Quiz Records', table: 'quizzes' }
      ]}
    />
  );
}
