import { supabase } from './supabase';
import { StudyFormat, StudyPayload } from '../types';

export const aiService = {
  async generate(
    type: StudyFormat,
    fileId: string,
    questionCount: number,
    signal?: AbortSignal
  ): Promise<StudyPayload> {
    const { data, error } = await supabase.functions.invoke('generate-ai', {
      body: {
        type,
        fileId,
        questionCount,
      },
      signal,
      timeout: 125_000,
    });

    if (error) {
      if (signal?.aborted) throw new Error('Generation cancelled.');
      let message = error.message;
      const context = (error as any).context;
      if (error.name === 'FunctionsFetchError') {
        if (context?.name === 'AbortError' || context?.name === 'TimeoutError') {
          message = 'Generation timed out while contacting the AI service. Try again or use a smaller file.';
        } else if (context?.message) {
          message = `Could not reach the AI function: ${context.message}`;
        }
      }
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          message = body?.error || message;
        } catch {
          // Keep the function client's message if the response isn't JSON.
        }
      }
      if (message.toLowerCase().includes('study material is required')) {
        message = 'The deployed AI function is outdated. Deploy the current function with: supabase functions deploy generate-ai';
      }
      throw new Error(message || 'AI generation failed.');
    }

    if (data?.error) throw new Error(data.error);
    if (!data?.result || typeof data.result !== 'object') {
      throw new Error('The AI did not return any generated content.');
    }

    return data.result as StudyPayload;
  },
};