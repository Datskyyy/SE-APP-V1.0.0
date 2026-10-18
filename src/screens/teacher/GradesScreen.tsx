import React from 'react';
import { GenericManagementScreen } from '../common/GenericManagementScreen';

export function GradesScreen() {
  return (
    <GenericManagementScreen
      title="Grades"
      subtitle="Gradebook overview"
      actions={[
        { label: 'Quiz Rows', table: 'quizzes' },
        { label: 'Reviewer Rows', table: 'reviewers' },
        { label: 'Generated Rows', table: 'generated_content' }
      ]}
    />
  );
}
