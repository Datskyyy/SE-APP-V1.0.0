import {
  classifyStudyFile,
  extractOfficeXml,
  parseAndValidateResult,
  requireExtractedStudyText,
  validateSourceByteLength,
} from './validation.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, messagePart: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(messagePart), `Unexpected validation error: ${String(error)}`);
    return;
  }
  throw new Error(`Expected validation to fail with: ${messagePart}`);
}

function mcq(index: number) {
  return {
    kind: 'mcq',
    prompt: `Question ${index}?`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 1,
    explanation: 'Supported by the source.',
  };
}

Deno.test('classifies supported source file types', () => {
  assert(classifyStudyFile('notes.PDF', 'application/pdf') === 'pdf', 'PDF should be supported');
  assert(classifyStudyFile('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') === 'docx', 'DOCX should be supported');
  assert(classifyStudyFile('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation') === 'pptx', 'PPTX should be supported');
  assert(classifyStudyFile('photo.jpg', 'image/jpeg') === 'image', 'JPG should be supported');
  assert(classifyStudyFile('photo.png', 'image/png') === 'image', 'PNG should be supported');
  assertThrows(() => classifyStudyFile('notes.pdf', 'image/png'), 'do not match');
  assertThrows(() => classifyStudyFile('notes.txt', 'text/plain'), 'not supported');
});

Deno.test('validates empty and oversized uploads and empty extraction', () => {
  validateSourceByteLength(1);
  assertThrows(() => validateSourceByteLength(0), 'empty or unreadable');
  assertThrows(() => validateSourceByteLength(20 * 1024 * 1024 + 1), '20 MB');
  assert(requireExtractedStudyText(' study text ') === 'study text', 'Extracted text should be trimmed');
  assertThrows(() => requireExtractedStudyText('  '), 'No selectable text');
});

Deno.test('extracts readable paragraphs from DOCX and PPTX XML', () => {
  const docxXml = '<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>First</w:t></w:r><w:r><w:t> paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:body></w:document>';
  const pptxXml = '<a:spTree xmlns:a="urn:drawing"><a:p><a:r><a:t>Slide title</a:t></a:r></a:p><a:p><a:r><a:t>Slide detail</a:t></a:r></a:p></a:spTree>';
  assert(extractOfficeXml(docxXml, 'p') === 'First paragraph\nSecond', 'DOCX paragraphs should be extracted');
  assert(extractOfficeXml(pptxXml, 'p') === 'Slide title\nSlide detail', 'PPTX paragraphs should be extracted');
});

Deno.test('validates structured summary output', () => {
  const result = parseAndValidateResult(JSON.stringify({
    kind: 'summary',
    title: 'Study summary',
    sections: [{ heading: 'Key idea', content: 'Source-based detail.', keyConcepts: ['concept'] }],
    keyTakeaways: ['Takeaway'],
  }), 'summary', 10) as Record<string, unknown>;
  assert(result.kind === 'summary', 'Summary kind should be preserved');
});

Deno.test('validates structured flashcards', () => {
  const result = parseAndValidateResult(JSON.stringify({
    kind: 'flashcards',
    cards: [{ front: 'Question', back: 'Answer' }],
  }), 'flashcards', 10) as Record<string, unknown>;
  assert(Array.isArray(result.cards) && result.cards.length === 1, 'Flashcard should be retained');
});

Deno.test('validates MCQ output with four choices and exact count', () => {
  const result = parseAndValidateResult(JSON.stringify({ kind: 'mcq', questions: Array.from({ length: 5 }, (_, index) => mcq(index)) }), 'mcq', 5) as Record<string, unknown>;
  assert(Array.isArray(result.questions) && result.questions.length === 5, 'Expected five validated MCQs');
  assertThrows(() => parseAndValidateResult(JSON.stringify({ kind: 'mcq', questions: [mcq(0)] }), 'mcq', 5), 'incomplete');
  assertThrows(() => parseAndValidateResult(JSON.stringify({ kind: 'mcq', questions: [{ ...mcq(0), options: ['A', 'B'] }] }), 'mcq', 1), 'four options');
  const aliased = parseAndValidateResult(JSON.stringify({ kind: 'multiple_choice', questions: Array.from({ length: 5 }, (_, index) => mcq(index)) }), 'mcq', 5) as Record<string, unknown>;
  assert(aliased.kind === 'mcq', 'Equivalent model labels should normalize to the selected format');
});

Deno.test('normalizes wrapped, bare-array, and structurally certain responses', () => {
  const wrapped = parseAndValidateResult(JSON.stringify({
    result: {
      format: 'multiple_choice',
      questions: Array.from({ length: 5 }, (_, index) => ({ ...mcq(index), kind: undefined })),
    },
  }), 'mcq', 5) as Record<string, unknown>;
  assert(wrapped.kind === 'mcq', 'Wrapped equivalent MCQ content should normalize');

  const flashcards = parseAndValidateResult(JSON.stringify([
    { front: 'Question', back: 'Answer' },
  ]), 'flashcards', 10) as Record<string, unknown>;
  assert(flashcards.kind === 'flashcards', 'A bare flashcard array should normalize');

  const shapeConfirmed = parseAndValidateResult(JSON.stringify({
    kind: 'summary',
    questions: Array.from({ length: 5 }, (_, index) => mcq(index)),
  }), 'mcq', 5) as Record<string, unknown>;
  assert(shapeConfirmed.kind === 'mcq', 'Unambiguous question structure should be authoritative');
});

Deno.test('validates true-false answers and exact count', () => {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    kind: 'true_false', prompt: `Statement ${index}`, answer: index % 2 === 0, explanation: 'Source-based.',
  }));
  const result = parseAndValidateResult(JSON.stringify({ kind: 'true_false', questions }), 'true_false', 5) as Record<string, unknown>;
  assert(Array.isArray(result.questions) && result.questions.length === 5, 'Expected five validated statements');
});

Deno.test('validates identification answers and accepted responses', () => {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    kind: 'identification', prompt: `Identify ${index}`, answer: 'Answer', acceptedAnswers: ['answer'], explanation: 'Source-based.',
  }));
  const result = parseAndValidateResult(JSON.stringify({ kind: 'identification', questions }), 'identification', 5) as Record<string, unknown>;
  assert(Array.isArray(result.questions) && result.questions.length === 5, 'Expected five validated identification questions');
  const withoutAcceptedAnswers = parseAndValidateResult(JSON.stringify({
    kind: 'identification',
    questions: questions.map(({ acceptedAnswers, ...question }) => question),
  }), 'identification', 5) as Record<string, unknown>;
  const firstQuestion = (withoutAcceptedAnswers.questions as Array<Record<string, unknown>>)[0];
  assert(Array.isArray(firstQuestion.acceptedAnswers) && firstQuestion.acceptedAnswers[0] === 'Answer', 'The answer should be accepted when no aliases are provided');
});

Deno.test('validates mixed mock exam questions', () => {
  const questions = [
    mcq(0),
    { kind: 'true_false', prompt: 'Statement', answer: true, explanation: 'Source-based.' },
    { kind: 'identification', prompt: 'Identify', answer: 'Answer', acceptedAnswers: ['Answer'], explanation: 'Source-based.' },
    mcq(3),
    { kind: 'true_false', prompt: 'Another statement', answer: false, explanation: 'Source-based.' },
  ];
  const result = parseAndValidateResult(JSON.stringify({ kind: 'mock_exam', questions }), 'mock_exam', 5) as Record<string, unknown>;
  assert(Array.isArray(result.questions) && result.questions.length === 5, 'Expected five validated mixed questions');
  const withoutQuestionKinds = parseAndValidateResult(JSON.stringify({
    kind: 'mock_exam',
    questions: questions.map(({ kind, ...question }) => question),
  }), 'mock_exam', 5) as Record<string, unknown>;
  const normalizedQuestions = withoutQuestionKinds.questions as Array<Record<string, unknown>>;
  assert(normalizedQuestions[0].kind === 'mcq' && normalizedQuestions[1].kind === 'true_false' && normalizedQuestions[2].kind === 'identification', 'Question kinds should be inferred from unambiguous fields');
  assertThrows(() => parseAndValidateResult(JSON.stringify({ kind: 'mock_exam', questions: Array.from({ length: 5 }, (_, index) => mcq(index)) }), 'mock_exam', 5), 'without mixed question types');
});

Deno.test('rejects malformed, mismatched, and empty AI results', () => {
  assertThrows(() => parseAndValidateResult('not json', 'summary', 10), 'invalid structured');
  assertThrows(() => parseAndValidateResult(JSON.stringify({ kind: 'mcq', questions: [] }), 'summary', 10), 'instead of summary');
  assertThrows(() => parseAndValidateResult(JSON.stringify({ kind: 'flashcards', cards: [] }), 'flashcards', 10), 'no flashcards');
});
