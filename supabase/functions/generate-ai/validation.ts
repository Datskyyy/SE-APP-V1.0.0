import { XMLParser } from 'fast-xml-parser';

export type StudyFormat = 'summary' | 'flashcards' | 'mcq' | 'true_false' | 'identification' | 'mock_exam';
export type SourceFormat = 'pdf' | 'docx' | 'pptx' | 'image';
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: false });

export function validateSourceByteLength(size: number) {
  if (!Number.isFinite(size) || size <= 0) throw new Error('The selected file is empty or unreadable.');
  if (size > MAX_SOURCE_BYTES) throw new Error('This file is larger than the 20 MB limit for generation.');
}

export function requireExtractedStudyText(text: string) {
  const extracted = text.trim();
  if (!extracted) {
    throw new Error('No selectable text was found. Scanned PDFs need OCR; try a text-based PDF, DOCX, or PPTX.');
  }
  return extracted;
}

function localName(name: string) {
  return name.slice(name.lastIndexOf(':') + 1);
}

function findXmlElements(value: unknown, targetName: string): unknown[] {
  if (Array.isArray(value)) return value.flatMap((item) => findXmlElements(item, targetName));
  if (!value || typeof value !== 'object') return [];

  const matches: unknown[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (localName(key) === targetName) matches.push(...(Array.isArray(child) ? child : [child]));
    else matches.push(...findXmlElements(child, targetName));
  }
  return matches;
}

function findXmlText(value: unknown): string[] {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(findXmlText);
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(findXmlText);
}

function collectXmlText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectXmlText);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    localName(key) === 't' ? findXmlText(child) : collectXmlText(child)
  );
}

export function extractOfficeXml(xml: string, paragraphName: string) {
  const document = xmlParser.parse(xml);
  return findXmlElements(document, paragraphName)
    .map((paragraph) => collectXmlText(paragraph).join('').trim())
    .filter(Boolean)
    .join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`The AI response is missing ${field}. Please retry generation.`);
  }
  return value.trim();
}

function requireStringArray(value: unknown, field: string, minLength = 0) {
  if (!Array.isArray(value) || value.length < minLength || value.some((item) => typeof item !== 'string')) {
    throw new Error(`The AI response has invalid ${field}. Please retry generation.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

export function classifyStudyFile(fileName: string, mimeType: string | null): SourceFormat {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const extensionFormats: Record<string, SourceFormat> = {
    pdf: 'pdf',
    docx: 'docx',
    pptx: 'pptx',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
  };
  const mimeFormats: Record<string, SourceFormat> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'image/jpeg': 'image',
    'image/png': 'image',
  };
  const extensionFormat = extensionFormats[extension];
  const mimeFormat = mimeFormats[mimeType || ''];

  if (extensionFormat && mimeFormat && extensionFormat !== mimeFormat) {
    throw new Error('The selected file extension and file type do not match.');
  }
  if (extensionFormat) return extensionFormat;
  if (mimeFormat) return mimeFormat;
  throw new Error('This file format is not supported. Upload a PDF, DOCX, PPTX, JPG, or PNG.');
}

function normalizeKind(kind: unknown): StudyFormat | null {
  if (typeof kind !== 'string') return null;
  const normalized = kind.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases: Record<string, StudyFormat> = {
    summary: 'summary',
    study_summary: 'summary',
    flashcard: 'flashcards',
    flashcards: 'flashcards',
    flashcard_set: 'flashcards',
    mcq: 'mcq',
    quiz: 'mcq',
    multiple_choice: 'mcq',
    true_false: 'true_false',
    true_or_false: 'true_false',
    identification: 'identification',
    identify: 'identification',
    mock_exam: 'mock_exam',
    exam: 'mock_exam',
  };
  return aliases[normalized] || null;
}

function hasRequestedShape(parsed: Record<string, unknown>, type: StudyFormat) {
  if (type === 'summary') {
    return (Array.isArray(parsed.sections) && parsed.sections.length > 0)
      || (typeof parsed.summary === 'string' && !!parsed.summary.trim());
  }
  if (type === 'flashcards') {
    const cards = Array.isArray(parsed) ? parsed : parsed.cards;
    return Array.isArray(cards) && cards.length > 0 && cards.every((card) => (
      isRecord(card) && typeof card.front === 'string' && typeof card.back === 'string'
    ));
  }

  if (!Array.isArray(parsed.questions) || !parsed.questions.length) return false;
  const questions = parsed.questions;
  const questionKind = (question: unknown) => isRecord(question)
    ? normalizeKind(question.kind ?? question.type ?? question.questionType)
    : null;

  if (type === 'mock_exam') {
    return new Set(questions.map(questionKind).filter(Boolean)).size > 1;
  }
  if (type === 'mcq') {
    return questions.every((question) => isRecord(question)
      && Array.isArray(question.options ?? question.choices)
      && ((question.options ?? question.choices) as unknown[]).length === 4);
  }
  if (type === 'true_false') {
    return questions.every((question) => isRecord(question)
      && (typeof question.answer === 'boolean' || ['true', 'false'].includes(String(question.answer).toLowerCase())));
  }
  return questions.every((question) => isRecord(question) && typeof question.answer === 'string');
}

export function parseAndValidateResult(responseText: string, type: StudyFormat, questionCount: number) {
  const jsonText = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('The AI returned an invalid structured result. Please retry generation.');
  }
  if (Array.isArray(parsed)) {
    parsed = type === 'flashcards'
      ? { kind: type, cards: parsed }
      : { kind: type, questions: parsed };
  }
  if (isRecord(parsed)) {
    const wrapperKeys = ['result', 'data', 'output', 'payload', 'content'];
    for (const key of wrapperKeys) {
      const wrapped = parsed[key];
      if (!isRecord(wrapped) && !Array.isArray(wrapped)) continue;
      const wrappedRecord = Array.isArray(wrapped)
        ? type === 'flashcards' ? { kind: type, cards: wrapped } : { kind: type, questions: wrapped }
        : wrapped;
      if (isRecord(wrappedRecord) && (
        normalizeKind(wrappedRecord.kind ?? wrappedRecord.format ?? wrappedRecord.type) === type
        || hasRequestedShape(wrappedRecord, type)
      )) {
        parsed = wrappedRecord;
        break;
      }
    }
  }
  if (!isRecord(parsed)) {
    throw new Error('The AI returned a result in an unsupported shape. Please retry generation.');
  }
  const returnedKind = normalizeKind(parsed.kind ?? parsed.format ?? parsed.type);
  if (returnedKind && returnedKind !== type && !hasRequestedShape(parsed, type)) {
    throw new Error(`The AI returned ${returnedKind.replace('_', ' ')} content instead of ${type.replace('_', ' ')}. Please retry generation.`);
  }
  if (!returnedKind && !hasRequestedShape(parsed, type)) {
    throw new Error(`The AI result did not match the selected ${type.replace('_', ' ')} format. Please retry generation.`);
  }
  parsed.kind = type;

  if (type === 'summary') {
    if (!Array.isArray(parsed.sections) && typeof parsed.summary === 'string') {
      parsed.sections = [{ heading: 'Summary', content: parsed.summary, keyConcepts: [] }];
    }
    if (!Array.isArray(parsed.sections) || !parsed.sections.length) {
      throw new Error('The AI returned an empty summary. Please retry generation.');
    }
    parsed.sections = parsed.sections.map((section) => {
      if (!isRecord(section)) throw new Error('The AI returned an invalid summary section. Please retry generation.');
      return {
        heading: requireString(section.heading ?? section.title, 'a section heading'),
        content: requireString(section.content ?? section.body, 'section content'),
        keyConcepts: requireStringArray(section.keyConcepts ?? section.key_concepts ?? [], 'section key concepts'),
      };
    });
    parsed.title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Study summary';
    const normalizedSections = parsed.sections as Array<Record<string, unknown>>;
    parsed.keyTakeaways = requireStringArray(
      parsed.keyTakeaways ?? parsed.key_takeaways ?? normalizedSections.flatMap((section) => section.keyConcepts as string[]),
      'summary takeaways',
      1
    );
  } else if (type === 'flashcards') {
    parsed.cards = Array.isArray(parsed.cards) ? parsed.cards : Array.isArray(parsed) ? parsed : [];
    if (!Array.isArray(parsed.cards) || !parsed.cards.length) {
      throw new Error('The AI returned no flashcards. Please retry generation.');
    }
    parsed.cards = parsed.cards.map((card) => {
      if (!isRecord(card)) throw new Error('The AI returned an invalid flashcard. Please retry generation.');
      return { front: requireString(card.front, 'a flashcard question'), back: requireString(card.back, 'a flashcard answer') };
    });
  } else {
    if (!Array.isArray(parsed.questions) || parsed.questions.length !== questionCount) {
      throw new Error(`The AI returned an incomplete set. Expected ${questionCount} questions; please retry.`);
    }
    parsed.questions = parsed.questions.map((question) => {
      if (!isRecord(question)) throw new Error('The AI returned an invalid question. Please retry generation.');
      const kind = normalizeKind(question.kind ?? question.type ?? question.questionType)
        || (type === 'mcq' || type === 'true_false' || type === 'identification' ? type : null);
      const prompt = requireString(question.prompt ?? question.question ?? question.statement, 'a question prompt');
      const explanation = requireString(question.explanation ?? question.rationale, 'a question explanation');
      if (kind === 'mcq' && (type === 'mcq' || type === 'mock_exam')) {
        const options = question.options ?? question.choices;
        if (!Array.isArray(options) || options.length !== 4 || options.some((option) => typeof option !== 'string' || !option.trim())) {
          throw new Error('The AI returned a multiple-choice question without four options. Please retry.');
        }
        let answerIndex = question.answerIndex;
        if (!Number.isInteger(answerIndex)) {
          const correctAnswer = question.correctAnswer ?? question.correct_answer ?? question.answer;
          if (typeof correctAnswer === 'string') {
            answerIndex = options.findIndex((option: string) => option.trim().toLowerCase() === correctAnswer.trim().toLowerCase());
          }
        }
        if (!Number.isInteger(answerIndex) || (answerIndex as number) < 0 || (answerIndex as number) > 3) {
          throw new Error('The AI returned an invalid multiple-choice answer. Please retry.');
        }
        return { kind, prompt, options: options.map((option: string) => option.trim()), answerIndex, explanation };
      }
      if (kind === 'true_false' && (type === 'true_false' || type === 'mock_exam')) {
        const rawAnswer = question.answer ?? question.correctAnswer;
        const answer = typeof rawAnswer === 'boolean' ? rawAnswer : String(rawAnswer).toLowerCase() === 'true' ? true : String(rawAnswer).toLowerCase() === 'false' ? false : null;
        if (answer === null) throw new Error('The AI returned an invalid true-or-false answer. Please retry.');
        return { kind, prompt, answer, explanation };
      }
      if (kind === 'identification' && (type === 'identification' || type === 'mock_exam')) {
        const answer = requireString(question.answer, 'an identification answer');
        const acceptedAnswers = requireStringArray(question.acceptedAnswers, 'accepted answers', 1);
        if (!acceptedAnswers.some((accepted) => accepted.toLowerCase() === answer.toLowerCase())) acceptedAnswers.push(answer);
        return { kind, prompt, answer, acceptedAnswers, explanation };
      }
      throw new Error('The AI returned an unsupported question type. Please retry generation.');
    });
    const validatedQuestions = parsed.questions as Record<string, unknown>[];
    if (type === 'mock_exam' && new Set(validatedQuestions.map((question) => question.kind)).size < 2) {
      throw new Error('The AI returned a mock exam without mixed question types. Please retry generation.');
    }
  }

  return parsed;
}
