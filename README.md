# EduFile (Expo SDK 54 + Supabase)

EduFile is now wired as a dynamic React Native app with:
- Working Supabase authentication (register/login/reset)
- Dynamic dashboard + streak tracking
- File upload + generated study content
- Live library, progress, profile, and quiz/reviewer screens

## 1) Install and run

1. Install Node.js LTS
2. Install dependencies
   - `npm install`
3. Configure environment variables in `.env`
   - `EXPO_PUBLIC_SUPABASE_URL=...`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
4. Start app
   - `npx expo start`

## 2) Supabase setup

1. Open Supabase SQL editor and run `supabase/schema.sql`
2. Create storage bucket: `study-files` (private)
3. Ensure RLS is enabled (included in schema)

## 3) Project structure (where files go)

- `App.tsx` app entry + providers
- `src/navigation/AppNavigator.tsx` auth stack + tabs + feature routes
- `src/hooks/useAuth.tsx` auth state/session/profile sync
- `src/services/supabase.ts` Supabase client
- `src/services/authService.ts` sign in/up/out/reset
- `src/services/appService.ts` activity logging, streak logic, uploads, progress, dashboards
- `src/services/aiService.ts` generation logic
- `src/screens/auth/*` login/register/forgot password
- `src/screens/tabs/*` dynamic dashboard, library, generate, insights, profile
- `src/screens/tabs/FlashcardsScreen.tsx` latest flashcards
- `src/screens/tabs/MCQScreen.tsx` latest MCQ
- `src/screens/tabs/TrueFalseScreen.tsx` latest True/False
- `src/screens/tabs/IdentificationScreen.tsx` latest Identification
- `src/screens/common/GenericManagementScreen.tsx` dynamic count-based management view
- `src/components/*` reusable buttons/cards/layout
- `src/types/index.ts` app data interfaces
- `src/utils/validators.ts` form validation helpers
- `supabase/schema.sql` database schema + RLS policies

## 4) Database tables used

- `users`
- `files`
- `generated_content`
- `activities`
- `streaks`
- `reviewers`
- `quizzes`
- `progress`

## 5) Streak + encouragement logic

In `src/services/appService.ts`:
- Streak increments for consecutive-day activity
- Resets to 1 after a missed day when user resumes
- Dashboard encouragement is selected from:
  - "You're just getting started. Keep going!"
  - "Nice work! You're building a strong habit."
  - "Amazing consistency! Keep the momentum!"
  - "It's okay, start again today!"
