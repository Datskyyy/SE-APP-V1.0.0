export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
}

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export type GeneratedType =
  | 'summary'
  | 'flashcards'
  | 'mcq'
  | 'true_false'
  | 'identification';

export type StudyFormat = GeneratedType | 'mock_exam';

export interface SummarySection {
  heading: string;
  content: string;
  keyConcepts: string[];
}

export interface MultipleChoiceQuestion {
  kind: 'mcq';
  prompt: string;
  options: [string, string, string, string];
  answerIndex: number;
  explanation: string;
}

export interface TrueFalseQuestion {
  kind: 'true_false';
  prompt: string;
  answer: boolean;
  explanation: string;
}

export interface IdentificationQuestion {
  kind: 'identification';
  prompt: string;
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
}

export type StudyQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | IdentificationQuestion;

export type StudyPayload =
  | {
      kind: 'summary';
      title: string;
      sections: SummarySection[];
      keyTakeaways: string[];
    }
  | { kind: 'flashcards'; cards: { front: string; back: string }[] }
  | { kind: 'mcq'; questions: MultipleChoiceQuestion[] }
  | { kind: 'true_false'; questions: TrueFalseQuestion[] }
  | { kind: 'identification'; questions: IdentificationQuestion[] }
  | { kind: 'mock_exam'; questions: StudyQuestion[] };

export interface StudySessionState {
  answers: Record<string, string | number | boolean>;
  revealed: Record<string, boolean>;
  knownCardIndexes: number[];
  shuffleOrder: number[];
  currentIndex?: number;
  examStartedAt?: string | null;
  examSubmitted?: boolean;
}

export type LibraryFilterType =
  | 'summaries'
  | 'quizzes'
  | 'flashcards'
  | 'all';

export const QUIZ_TYPES: GeneratedType[] = [
  'mcq',
  'true_false',
  'identification',
];

export interface GeneratedContent {
  id: string;
  user_id: string;
  file_id: string | null;
  type: GeneratedType;
  format?: StudyFormat;
  title: string;
  content: string;
  created_at: string;
  request_id?: string;
  source_file_name?: string | null;
  study_state?: StudySessionState;
}

export interface StreakRecord {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}

export interface DashboardData {
  currentStreak: number;
  longestStreak: number;
  todayActivities: number;
  weeklyActivities: number;
  generatedCount: number;
  encouragement: string;
  recentFiles?: {
    id: string;
    title: string;
    subject: string;
    completion: number;
    content: string;
  }[];
  weeklyChart?: number[];
}

export interface UploadedFile {
  id: string;
  name: string;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  size_bytes?: number | null;
  last_accessed_at?: string;
}

export interface UserFolder {
  id: string;
  name: string;
  created_at: string;
}

export interface StudyActivityPoint {
  date: string;
  count: number;
}

export interface HomeDashboardData {
  totalFiles: number;
  totalFolders: number;
  filesAccessedThisWeek: number;
  studyActivity: StudyActivityPoint[];
  recentlyAccessedFiles: UploadedFile[];
}