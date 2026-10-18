import { supabase } from './supabase';
import {
  DashboardData,
  GeneratedContent,
  GeneratedType,
  HomeDashboardData,
  StudyFormat,
  StudyPayload,
  StudySessionState,
  StudyActivityPoint,
  StreakRecord,
  UploadedFile,
  UserFolder,
} from '../types';

type RecentFile = {
  id: string;
  title: string;
  subject: string;
  completion: number;
  content: string;
};

type DashboardScreenData = DashboardData & {
  recentFiles: RecentFile[];
  weeklyChart: number[];
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const SUPPORTED_FILE_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayISO() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getLast7DaysISO() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function getLast7ActivityDates() {
  const dates: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function getActivityDates(dayCount: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - dayCount + index + 1);
    return date.toISOString().slice(0, 10);
  });
}

function getEncouragement(currentStreak: number, todayActivities: number) {
  if (!todayActivities && currentStreak === 0) {
    return "It's okay, start again today!";
  }

  if (currentStreak <= 1) {
    return "You're just getting started. Keep going!";
  }

  if (currentStreak <= 6) {
    return "Nice work! You're building a strong habit.";
  }

  return 'Amazing consistency! Keep the momentum!';
}

function formatGeneratedType(type: string) {
  if (type === 'summary') return 'Summary';
  if (type === 'flashcards') return 'Flashcards';
  if (type === 'mcq') return 'Multiple Choice';
  if (type === 'true_false') return 'True or False';
  if (type === 'identification') return 'Identification';

  return 'Generated';
}

async function ensureStreakRow(userId: string) {
  const { data, error } = await supabase
    .from('streaks')
    .select('user_id, current_streak, longest_streak, last_activity_date')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as StreakRecord;

  const fallback: StreakRecord = {
    user_id: userId,
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null,
  };

  const { error: upsertError } = await supabase
    .from('streaks')
    .upsert(fallback, { onConflict: 'user_id' });

  if (upsertError) throw upsertError;

  return fallback;
}

async function updateProgress(userId: string) {
  const [reviewersResult, quizzesResult] = await Promise.all([
    supabase
      .from('reviewers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    supabase
      .from('quizzes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  if (reviewersResult.error) throw reviewersResult.error;
  if (quizzesResult.error) throw quizzesResult.error;

  const reviewersCount = reviewersResult.count || 0;
  const quizzesCount = quizzesResult.count || 0;
  const total = reviewersCount + quizzesCount;
  const completionRate = Math.min(100, total * 5);

  const { error: progressError } = await supabase
    .from('progress')
    .upsert(
      {
        user_id: userId,
        total_reviewers: reviewersCount,
        total_quizzes: quizzesCount,
        completion_rate: completionRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (progressError) throw progressError;
}

function buildWeeklyChart(activityRows: { activity_date: string | null }[]) {
  const dates = getLast7ActivityDates();
  const counts: Record<string, number> = {};

  dates.forEach((date) => {
    counts[date] = 0;
  });

  activityRows.forEach((item) => {
    if (item.activity_date && counts[item.activity_date] !== undefined) {
      counts[item.activity_date] += 1;
    }
  });

  return dates.map((date) => counts[date]);
}

export const appService = {
  async logActivity(userId: string, type: string, meta?: Record<string, unknown>) {
    const today = getTodayISO();

    const { error } = await supabase.from('activities').insert({
      user_id: userId,
      activity_type: type,
      activity_date: today,
      meta: meta || {},
    });

    if (error) throw error;

    const streak = await ensureStreakRow(userId);

    const lastDate = streak.last_activity_date;
    const yesterday = getYesterdayISO();
    const isSameDay = lastDate === today;
    const isConsecutive = lastDate === yesterday;

    const nextStreak = isSameDay
      ? streak.current_streak
      : isConsecutive
        ? streak.current_streak + 1
        : 1;

    const longest = Math.max(streak.longest_streak, nextStreak);

    const { error: streakError } = await supabase
      .from('streaks')
      .upsert(
        {
          user_id: userId,
          current_streak: nextStreak,
          longest_streak: longest,
          last_activity_date: today,
        },
        { onConflict: 'user_id' }
      );

    if (streakError) throw streakError;
  },

  async uploadAndSaveFile(
    userId: string,
    uri: string,
    name: string,
    mimeType?: string
  ) {
    const extension = name.split('.').pop()?.toLowerCase() || '';
    const supportedMimeTypes = SUPPORTED_FILE_TYPES[extension];
    if (!supportedMimeTypes) {
      throw new Error('Unsupported file type. Choose PDF, DOCX, PPTX, JPG, or PNG.');
    }
    if (mimeType && mimeType !== 'application/octet-stream' && !supportedMimeTypes.includes(mimeType)) {
      throw new Error('The selected file extension and file type do not match.');
    }
    const contentType = mimeType && supportedMimeTypes.includes(mimeType)
      ? mimeType
      : supportedMimeTypes[0];

    const fileRes = await fetch(uri);
    if (!fileRes.ok) throw new Error('The selected file could not be read. Please choose it again.');
    const fileBuffer = await fileRes.arrayBuffer();
    if (!fileBuffer.byteLength) throw new Error('The selected file is empty.');
    if (fileBuffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error('Files must be 20 MB or smaller.');
    }

    const safeName = name.replace(/[\\/]/g, '-').replace(/\s+/g, '-');
    const storagePath = `${userId}/${Date.now()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('study-files')
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data, error } = await supabase
      .from('files')
      .insert({
        user_id: userId,
        name,
        mime_type: contentType,
        storage_path: storagePath,
        size_bytes: fileBuffer.byteLength,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      await supabase.storage.from('study-files').remove([storagePath]);
      throw error;
    }

    if (!data) {
      await supabase.storage.from('study-files').remove([storagePath]);
      throw new Error(
        'File was saved, but no file data was returned. Check your Supabase SELECT/RLS policy for files.'
      );
    }

    void appService.logActivity(userId, 'uploaded_file', {
      file_id: data.id,
      file_name: name,
    }).catch(() => undefined);

    return data;
  },

  async getHomeDashboardData(
    userId: string,
    period: 7 | 30
  ): Promise<HomeDashboardData> {
    const dates = getActivityDates(period);
    const weekStart = getActivityDates(7)[0];
    const [filesResult, foldersResult, accessResult, recentAccessResult] =
      await Promise.all([
        supabase
          .from('files')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('folders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('file_accesses')
          .select('file_id, access_date, accessed_at')
          .eq('user_id', userId)
          .gte('access_date', dates[0])
          .lte('access_date', dates[dates.length - 1])
          .order('accessed_at', { ascending: false }),
        supabase
          .from('file_accesses')
          .select('file_id, accessed_at')
          .eq('user_id', userId)
          .order('accessed_at', { ascending: false })
          .limit(50),
      ]);

    if (filesResult.error) throw filesResult.error;
    if (foldersResult.error) throw foldersResult.error;
    if (accessResult.error) throw accessResult.error;
    if (recentAccessResult.error) throw recentAccessResult.error;

    const activityCounts = new Map<string, number>(
      dates.map((date) => [date, 0])
    );
    const weeklyFileIds = new Set<string>();

    for (const access of accessResult.data || []) {
      activityCounts.set(
        access.access_date,
        (activityCounts.get(access.access_date) || 0) + 1
      );
      if (access.access_date >= weekStart) weeklyFileIds.add(access.file_id);
    }

    const recentAccesses = recentAccessResult.data || [];
    const lastAccessByFile = new Map<string, string>();
    for (const access of recentAccesses) {
      if (!lastAccessByFile.has(access.file_id)) {
        lastAccessByFile.set(access.file_id, access.accessed_at);
      }
    }

    const recentFileIds = Array.from(lastAccessByFile.keys());
    let recentlyAccessedFiles: UploadedFile[] = [];
    if (recentFileIds.length) {
      const { data, error } = await supabase
        .from('files')
        .select('id, name, mime_type, storage_path, created_at')
        .eq('user_id', userId)
        .in('id', recentFileIds);

      if (error) throw error;

      const filesById = new Map((data || []).map((file) => [file.id, file]));
      recentlyAccessedFiles = recentFileIds.flatMap((fileId) => {
        const file = filesById.get(fileId);
        const lastAccessedAt = lastAccessByFile.get(fileId);
        return file && lastAccessedAt ? [{ ...file, last_accessed_at: lastAccessedAt }] : [];
      });
    }

    const studyActivity: StudyActivityPoint[] = dates.map((date) => ({
      date,
      count: activityCounts.get(date) || 0,
    }));

    return {
      totalFiles: filesResult.count || 0,
      totalFolders: foldersResult.count || 0,
      filesAccessedThisWeek: weeklyFileIds.size,
      studyActivity,
      recentlyAccessedFiles,
    };
  },

  async getUploadedFiles(userId: string): Promise<UploadedFile[]> {
    const { data, error } = await supabase
      .from('files')
      .select('id, name, mime_type, storage_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteUploadedFile(userId: string, fileId: string) {
    const { data: file, error: lookupError } = await supabase
      .from('files')
      .select('id, name, storage_path')
      .eq('id', fileId)
      .eq('user_id', userId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!file) throw new Error('File not found or you do not have permission to delete it.');

    const { error: storageError } = await supabase.storage
      .from('study-files')
      .remove([file.storage_path]);

    if (storageError) throw storageError;

    const { data: deletedFile, error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (!deletedFile) throw new Error('The file record could not be deleted.');
  },

  async getFolders(userId: string): Promise<UserFolder[]> {
    const { data, error } = await supabase
      .from('folders')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createFolder(userId: string, name: string): Promise<UserFolder> {
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: userId, name: name.trim() })
      .select('id, name, created_at')
      .single();

    if (error) throw error;
    return data;
  },

  async recordFileAccess(userId: string, fileId: string) {
    const accessedAt = new Date().toISOString();
    const { error } = await supabase.from('file_accesses').upsert(
      {
        user_id: userId,
        file_id: fileId,
        access_date: accessedAt.slice(0, 10),
        accessed_at: accessedAt,
      },
      { onConflict: 'user_id,file_id,access_date' }
    );

    if (error) throw error;
  },

  async getFileDownloadUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('study-files')
      .createSignedUrl(storagePath, 60);

    if (error) throw error;
    return data.signedUrl;
  },

  async saveGeneratedContent(
    userId: string,
    format: StudyFormat,
    title: string,
    payload: StudyPayload,
    fileId: string,
    sourceFileName: string,
    requestId: string
  ) {
    const { data: existing, error: lookupError } = await supabase
      .from('generated_content')
      .select('*')
      .eq('user_id', userId)
      .eq('request_id', requestId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) return existing as GeneratedContent;

    const type: GeneratedType = format === 'mock_exam' ? 'mcq' : format;
    const { data, error } = await supabase
      .from('generated_content')
      .insert({
        user_id: userId,
        file_id: fileId,
        type,
        format,
        title,
        content: JSON.stringify(payload),
        request_id: requestId,
        source_file_name: sourceFileName,
        study_state: {
          answers: {},
          revealed: {},
          knownCardIndexes: [],
          shuffleOrder: [],
          examStartedAt: null,
          examSubmitted: false,
        },
      })
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        const { data: duplicate, error: duplicateError } = await supabase
          .from('generated_content')
          .select('*')
          .eq('user_id', userId)
          .eq('request_id', requestId)
          .maybeSingle();
        if (!duplicateError && duplicate) return duplicate as GeneratedContent;
      }
      throw error;
    }

    if (!data) {
      throw new Error(
        'Generated content was saved, but no data was returned. Check your Supabase SELECT/RLS policy for generated_content.'
      );
    }

    try {
      if (type === 'summary' || type === 'flashcards') {
        const { error: reviewerError } = await supabase.from('reviewers').insert({
          user_id: userId,
          generated_content_id: data.id,
          reviewer_type: type,
          title,
        });

        if (reviewerError) throw reviewerError;
      } else {
        const { error: quizError } = await supabase.from('quizzes').insert({
          user_id: userId,
          generated_content_id: data.id,
          quiz_type: type,
          title,
        });

        if (quizError) throw quizError;
      }

      await updateProgress(userId).catch(() => undefined);
      void appService.logActivity(userId, `generated_${format}`, {
        generated_content_id: data.id,
      }).catch(() => undefined);
    } catch (saveError) {
      await supabase
        .from('generated_content')
        .delete()
        .eq('id', data.id)
        .eq('user_id', userId);
      throw saveError;
    }

    return data as GeneratedContent;
  },

  async getGeneratedContent(userId: string, id: string): Promise<GeneratedContent | null> {
    const { data, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as GeneratedContent | null;
  },

  async renameGeneratedContent(userId: string, id: string, title: string) {
    const { data, error } = await supabase
      .from('generated_content')
      .update({ title: title.trim() })
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('The material could not be found in your Library.');
    return data as GeneratedContent;
  },

  async updateStudySessionState(userId: string, id: string, studyState: StudySessionState) {
    const { error } = await supabase
      .from('generated_content')
      .update({ study_state: studyState })
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteGeneratedContent(id: string, userId: string) {
    const [reviewerDelete, quizDelete] = await Promise.all([
      supabase
        .from('reviewers')
        .delete()
        .eq('generated_content_id', id)
        .eq('user_id', userId),

      supabase
        .from('quizzes')
        .delete()
        .eq('generated_content_id', id)
        .eq('user_id', userId),
    ]);

    if (reviewerDelete.error) throw reviewerDelete.error;
    if (quizDelete.error) throw quizDelete.error;

    const { error } = await supabase
      .from('generated_content')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    await updateProgress(userId).catch(() => undefined);

    void appService.logActivity(userId, 'deleted_generated_content', {
      generated_content_id: id,
    }).catch(() => undefined);
  },

  async getDashboardData(userId: string): Promise<DashboardScreenData> {
    const today = getTodayISO();
    const last7DateOnly = getLast7ActivityDates()[0];

    const [
      streak,
      todayResult,
      weeklyActivitiesResult,
      generatedResult,
      recentResult,
      chartActivitiesResult,
    ] = await Promise.all([
      ensureStreakRow(userId),

      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('activity_date', today),

      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', getLast7DaysISO()),

      supabase
        .from('generated_content')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),

      supabase
        .from('generated_content')
        .select('id, title, type, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('activities')
        .select('activity_date')
        .eq('user_id', userId)
        .gte('activity_date', last7DateOnly),
    ]);

    if (todayResult.error) throw todayResult.error;
    if (weeklyActivitiesResult.error) throw weeklyActivitiesResult.error;
    if (generatedResult.error) throw generatedResult.error;
    if (recentResult.error) throw recentResult.error;
    if (chartActivitiesResult.error) throw chartActivitiesResult.error;

    const todayActivities = todayResult.count || 0;
    const weeklyActivities = weeklyActivitiesResult.count || 0;
    const generatedCount = generatedResult.count || 0;

    const recentFiles: RecentFile[] = (recentResult.data || []).map((item) => ({
      id: item.id,
      title: item.title || 'Untitled File',
      subject: formatGeneratedType(item.type),
      completion: 100,
      content: item.content || 'No content available.',
    }));

    const weeklyChart = buildWeeklyChart(chartActivitiesResult.data || []);

    return {
      currentStreak: streak.current_streak,
      longestStreak: streak.longest_streak,
      todayActivities,
      weeklyActivities,
      generatedCount,
      encouragement: getEncouragement(streak.current_streak, todayActivities),
      recentFiles,
      weeklyChart,
    };
  },

  async getLibrary(userId: string) {
    const { data, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data as GeneratedContent[];
  },

  async getLatestByType(userId: string, type: GeneratedType) {
    const { data, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data as GeneratedContent | null;
  },

  async getProgress(userId: string) {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return data;
  },

  async getEntityCount(table: string, userId?: string) {
    let query = supabase.from(table).select('*', {
      count: 'exact',
      head: true,
    });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  },
};