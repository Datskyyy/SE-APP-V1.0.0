import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function TeacherManagementScreen() {
  return (
    <GenericManagementScreen
      title="Teacher Workspace"
      subtitle="Track teaching-related data"
      actions={[
        { label: 'Study Activities', table: 'activities' },
        { label: 'Reviewers Created', table: 'reviewers' },
        { label: 'Quizzes Created', table: 'quizzes' }
      ]}
    />
  );
}
