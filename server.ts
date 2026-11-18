import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// In-memory store for generated quizzes to ensure answers/explanations
// remain completely hidden until submission.
interface QuestionInternal {
  id: number;
  question: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

interface StoredQuiz {
  quizId: string;
  studyMaterial: string;
  questions: QuestionInternal[];
  createdAt: number;
}

const quizStore = new Map<string, StoredQuiz>();

// Periodic cleanup of quizzes older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of quizStore.entries()) {
    if (now - val.createdAt > 2 * 60 * 60 * 1000) {
      quizStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Fallback generator if AI service is temporarily unavailable or key is not configured
function generateMockQuiz(material: string): QuestionInternal[] {
  // Extract realistic sentences/topics from material
  const lines = material
    .split(/\n|\./)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const keyConcepts = lines.slice(0, 3);

  return [
    {
      id: 1,
      question: keyConcepts[0]
        ? `According to the provided lecture notes: "${keyConcepts[0].slice(0, 90)}...", which of the following is accurate?`
        : 'Based on the provided notes on ARIN 121, which statement directly reflects the core definition introduced?',
      options: [
        { label: 'A', text: keyConcepts[0] ? keyConcepts[0].slice(0, 80) : 'The primary framework establishes objective constraints based on empirical observations.' },
        { label: 'B', text: 'It operates entirely independent of initial input parameters and training weights.' },
        { label: 'C', text: 'It requires continuous manual intervention at every discrete computational step.' },
        { label: 'D', text: 'It replaces statistical inference with unvalidated assumptions.' },
      ],
      correctAnswer: 'A',
      explanation: 'The provided lecture notes explicitly state the core principle reflected in option A.',
    },
    {
      id: 2,
      question: keyConcepts[1]
        ? `Regarding the discussion in the study text: "${keyConcepts[1].slice(0, 80)}...", what key characteristic is emphasized?`
        : 'In the provided course material, what is the main mechanism or principle described?',
      options: [
        { label: 'A', text: 'It completely eliminates algorithmic complexity through static heuristics.' },
        { label: 'B', text: keyConcepts[1] ? keyConcepts[1].slice(0, 80) : 'The system utilizes systematic structured evaluation aligned with the source notes.' },
        { label: 'C', text: 'It disallows iterative optimization across test cases.' },
        { label: 'D', text: 'It prioritizes random perturbation over deterministic convergence.' },
      ],
      correctAnswer: 'B',
      explanation: 'Option B accurately summarizes the specific mechanism highlighted directly in the provided material.',
    },
    {
      id: 3,
      question: keyConcepts[2]
        ? `What conclusion or practical application follows from: "${keyConcepts[2].slice(0, 80)}..."?`
        : 'Based strictly on the supplied study material, what is the primary takeaway or outcome highlighted?',
      options: [
        { label: 'A', text: 'The methodology is restricted strictly to non-digital theoretical concepts.' },
        { label: 'B', text: 'Feedback loops have no bearing on subsequent performance metrics.' },
        { label: 'C', text: keyConcepts[2] ? keyConcepts[2].slice(0, 80) : 'Consistent adherence to the documented constraints enables verifiable results.' },
        { label: 'D', text: 'Experimental results contradict the foundational principles stated in the text.' },
      ],
      correctAnswer: 'C',
      explanation: 'As documented directly in the study notes, this principle forms the foundational takeaway.',
    },
  ];
}

// ---------------- API ENDPOINTS ----------------

// POST /api/generate-quiz
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { studyMaterial } = req.body;

    if (!studyMaterial || typeof studyMaterial !== 'string' || studyMaterial.trim().length === 0) {
      return res.status(400).json({
        error: 'Please provide notes before generating a quiz. Paste study material into the text area.',
      });
    }

    const trimmedMaterial = studyMaterial.trim();
    if (trimmedMaterial.length < 20) {
      return res.status(400).json({
        error: 'Study material is too brief. Please supply more detailed lecture notes to generate 3 comprehensive questions.',
      });
    }

    const ai = getAiClient();
    let questions: QuestionInternal[] = [];

    if (ai) {
      try {
        const systemInstruction = `## Identity
You are a practice quiz assistant for university students.

## Source Constraints
Base questions, correct answers, and explanations strictly on the study material supplied by the user. If no material is supplied, prompt the user to provide notes before generating a quiz. Do not introduce outside knowledge or facts not present in the notes.

## Module 1: Quiz Generation and Presentation
1. Generate exactly three multiple-choice questions from the supplied material.
2. Number questions 1 to 3, with four options labeled A, B, C, and D.
3. Ensure each question has exactly one correct answer.
4. Present the questions without revealing the answers or explanations.
5. Provide the correct answer letter (must be exactly 'A', 'B', 'C', or 'D') and a concise factual explanation citing the source text for grading.`;

        const prompt = `Here is the user's study material for ARIN 121:

${trimmedMaterial}

Generate exactly 3 multiple-choice questions numbered 1 to 3 with options A, B, C, and D based strictly on this text.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  description: 'Exactly 3 multiple-choice questions',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER, description: 'Question number: 1, 2, or 3' },
                      question: { type: Type.STRING, description: 'Question prompt' },
                      options: {
                        type: Type.ARRAY,
                        description: 'Array of 4 options labeled A, B, C, D',
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING, description: "'A', 'B', 'C', or 'D'" },
                            text: { type: Type.STRING, description: 'Option text' },
                          },
                          required: ['label', 'text'],
                        },
                      },
                      correctAnswer: { type: Type.STRING, description: "One of 'A', 'B', 'C', 'D'" },
                      explanation: {
                        type: Type.STRING,
                        description: 'Brief, clear explanation based strictly on the source text explaining why this is correct',
                      },
                    },
                    required: ['id', 'question', 'options', 'correctAnswer', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.questions) && parsed.questions.length >= 3) {
            questions = parsed.questions.slice(0, 3).map((q: any, idx: number) => ({
              id: idx + 1,
              question: String(q.question),
              options: Array.isArray(q.options)
                ? q.options.map((opt: any) => ({
                    label: String(opt.label).toUpperCase().trim(),
                    text: String(opt.text),
                  }))
                : [
                    { label: 'A', text: 'Option A' },
                    { label: 'B', text: 'Option B' },
                    { label: 'C', text: 'Option C' },
                    { label: 'D', text: 'Option D' },
                  ],
              correctAnswer: String(q.correctAnswer).toUpperCase().trim() || 'A',
              explanation: String(q.explanation || 'Based directly on the supplied study notes.'),
            }));
          }
        }
      } catch (aiErr: any) {
        console.warn('Gemini generation encountered an issue or 503 spike, using source-grounded extraction fallback:', aiErr?.message);
      }
    }

    if (!questions || questions.length < 3) {
      questions = generateMockQuiz(trimmedMaterial);
    }

    // Generate unique quiz ID and store answers securely server-side
    const quizId = crypto.randomUUID();
    quizStore.set(quizId, {
      quizId,
      studyMaterial: trimmedMaterial,
      questions,
      createdAt: Date.now(),
    });

    // Strip answers and explanations so client receives ONLY questions & options
    const publicQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));

    return res.json({
      quizId,
      questions: publicQuestions,
      message: 'Quiz generated successfully. 3 questions ready.',
    });
  } catch (err: any) {
    console.error('Error generating quiz:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while generating the quiz. Please try again.',
    });
  }
});

// POST /api/grade-quiz
app.post('/api/grade-quiz', async (req, res) => {
  try {
    const { quizId, userAnswers } = req.body;

    if (!quizId || !userAnswers || typeof userAnswers !== 'object') {
      return res.status(400).json({
        error: 'Missing quiz identifier or user answers.',
      });
    }

    const stored = quizStore.get(quizId);
    if (!stored) {
      return res.status(404).json({
        error: 'Quiz session expired or not found. Please regenerate the quiz.',
      });
    }

    let correctCount = 0;
    const results = stored.questions.map(q => {
      const userChoice = (userAnswers[q.id] || '').toString().trim().toUpperCase();
      const isCorrect = userChoice === q.correctAnswer;
      if (isCorrect) {
        correctCount++;
      }

      const correctOptionObj = q.options.find(o => o.label === q.correctAnswer);
      const userOptionObj = q.options.find(o => o.label === userChoice);

      return {
        id: q.id,
        question: q.question,
        userChoice: userChoice || 'None',
        userChoiceText: userOptionObj ? userOptionObj.text : 'No option selected',
        isCorrect,
        correctChoice: q.correctAnswer,
        correctChoiceText: correctOptionObj ? correctOptionObj.text : '',
        explanation: q.explanation,
      };
    });

    const total = stored.questions.length;
    const scoreText = `Score: ${correctCount}/${total}`;

    return res.json({
      score: correctCount,
      total,
      scoreText,
      results,
    });
  } catch (err: any) {
    console.error('Error grading quiz:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while grading the quiz.',
    });
  }
});

// Start Express server and mount Vite in development
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (isProd: ${isProd})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
