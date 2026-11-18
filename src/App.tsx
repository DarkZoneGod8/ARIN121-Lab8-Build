import React, { useState, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  FileText,
  HelpCircle,
  GraduationCap,
  ArrowRight,
  ClipboardPaste,
  Trash2,
} from 'lucide-react';

interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D' | string;
  text: string;
}

interface Question {
  id: number;
  question: string;
  options: QuestionOption[];
}

interface QuestionResult {
  id: number;
  question: string;
  userChoice: string;
  userChoiceText: string;
  isCorrect: boolean;
  correctChoice: string;
  correctChoiceText: string;
  explanation: string;
}

interface GradingResponse {
  score: number;
  total: number;
  scoreText: string;
  results: QuestionResult[];
}

const SAMPLE_NOTES = [
  {
    title: 'Heuristic Search & A*',
    content: `ARIN 121 Lecture 4: Informed Search and the A* Algorithm
Informed search uses domain-specific knowledge beyond the problem definition to guide search. A heuristic function h(n) estimates the cheapest path from node n to the goal state. An admissible heuristic never overestimates the true cost to reach the goal (h(n) <= h*(n)). A consistent (monotonic) heuristic satisfies the triangle inequality: h(n) <= c(n, a, n') + h(n'). A* evaluates nodes using f(n) = g(n) + h(n), where g(n) is the exact cost from the start node to n. When using tree search, A* is optimal if h(n) is admissible. When using graph search, A* is optimal if h(n) is consistent. If h(n) = 0 everywhere, A* degrades into Dijkstra's uniform-cost algorithm.`,
  },
  {
    title: 'Neural Nets & Backpropagation',
    content: `ARIN 121 Lecture 7: Multilayer Perceptrons & Backpropagation
A multilayer perceptron (MLP) consists of an input layer, one or more hidden layers, and an output layer. Nonlinear activation functions such as ReLU, Sigmoid, and Tanh enable networks to model non-linear decision boundaries; without non-linear activations, multiple stacked linear layers collapse into a single equivalent linear transformation. The backpropagation algorithm computes the partial derivative of the scalar loss function with respect to every weight parameter using the chain rule of calculus. Forward propagation computes node activations, while backward propagation transmits error gradients in reverse order from the output layer to the earliest layers. Weights are updated via gradient descent: W_new = W_old - alpha * (dL/dW).`,
  },
  {
    title: 'AI Ethics & Algorithmic Bias',
    content: `ARIN 121 Lecture 11: Machine Learning Ethics and Bias Mitigation
Algorithmic bias occurs when automated decision systems produce systematic and unfair outcomes for specific demographic groups. Historical bias stems from training data reflecting existing human prejudices and socio-economic inequities. Representation bias arises when target populations are underrepresented in training distributions. Mitigations are categorized into: 1) Pre-processing methods (re-sampling, re-weighting dataset attributes before training), 2) In-processing methods (adding fairness constraints or regularization penalties directly to the loss function during model training), and 3) Post-processing methods (adjusting decision thresholds on test outputs). Transparency and model interpretability (e.g., SHAP, LIME) allow auditors to inspect feature attributions and verify compliance with institutional anti-discrimination standards.`,
  },
];

export default function App() {
  const [studyMaterial, setStudyMaterial] = useState<string>('');
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<GradingResponse | null>(null);

  const quizAreaRef = useRef<HTMLDivElement>(null);
  const resultsCardRef = useRef<HTMLDivElement>(null);

  const handleGenerateQuiz = async () => {
    setErrorMessage(null);
    setGradingResult(null);
    setUserAnswers({});

    if (!studyMaterial.trim()) {
      setErrorMessage('Please provide notes before generating a quiz. Paste your lecture material into the text area.');
      return;
    }

    if (studyMaterial.trim().length < 20) {
      setErrorMessage('Please provide more detailed notes (at least 20 characters) so 3 complete questions can be generated.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyMaterial: studyMaterial.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz. Please try again.');
      }

      setQuizId(data.quizId);
      setQuestions(data.questions || []);

      // Scroll to quiz area smoothly
      setTimeout(() => {
        quizAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while generating the quiz.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (questionId: number, optionLabel: string) => {
    // If already graded, do not allow changing until retake
    if (gradingResult) return;

    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionLabel,
    }));
  };

  const handleSubmitAnswers = async () => {
    if (!quizId) return;

    // Check if all 3 questions answered
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount < questions.length) {
      setErrorMessage(`Please select an answer for all ${questions.length} questions before submitting (${answeredCount} of ${questions.length} selected).`);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/grade-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          userAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grade answers.');
      }

      setGradingResult(data);

      setTimeout(() => {
        resultsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not submit answers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setUserAnswers({});
    setGradingResult(null);
    setErrorMessage(null);
    quizAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClearAll = () => {
    setStudyMaterial('');
    setQuestions([]);
    setQuizId(null);
    setUserAnswers({});
    setGradingResult(null);
    setErrorMessage(null);
  };

  const answeredCount = questions.filter(q => !!userAnswers[q.id]).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Academic Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                ARIN 121 - Interactive Study Quiz
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                University Course Assessment & Knowledge Retrieval
              </p>
            </div>
          </div>
          {questions.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Active Quiz: 3 Questions</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Banner / Instructions */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl shrink-0 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                Self-Assessment Quiz Generator
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Paste your ARIN 121 course lecture notes, readings, or slides below. The AI assistant generates exactly 3 multiple-choice questions strictly from your provided material. Answers and explanations are completely hidden until you submit your responses.
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: Study Material Input */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="study-material-textarea"
              className="block text-sm font-semibold text-slate-900"
            >
              Paste Study Material Here
            </label>
            <div className="flex items-center gap-3">
              {studyMaterial && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 rounded"
                  title="Clear text and reset quiz"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Notes</span>
                </button>
              )}
              <span className="text-xs text-slate-400">
                {studyMaterial.trim().split(/\s+/).filter(Boolean).length} words · {studyMaterial.length} chars
              </span>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="study-material-textarea"
              rows={7}
              value={studyMaterial}
              onChange={e => {
                setStudyMaterial(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Paste lecture notes here (e.g., definitions, search algorithms, heuristic evaluation, neural network architectures, optimization equations, or course slides)..."
              className="w-full rounded-xl border border-slate-300 p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition duration-150 resize-y leading-relaxed font-mono"
            />
          </div>

          {/* Quick-Load Samples for Rapid Testing */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-medium flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
                Quick-load ARIN 121 sample lecture notes:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_NOTES.map(sample => (
                <button
                  key={sample.title}
                  type="button"
                  onClick={() => {
                    setStudyMaterial(sample.content);
                    setErrorMessage(null);
                  }}
                  className="text-xs bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer text-left"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action Button: Generate Quiz */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={isGenerating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-300 text-white font-semibold text-sm rounded-xl shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating 3 Questions from Notes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>Generate Quiz</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Section 2: Quiz Area */}
        {questions.length > 0 && (
          <section
            ref={quizAreaRef}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-8 scroll-mt-20"
          >
            {/* Header of Quiz Area */}
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Multiple-Choice Questions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select one option per question. Answers and explanations are revealed only after submission.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                <span>
                  {answeredCount} of {questions.length} Answered
                </span>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-8">
              {questions.map((q, qIndex) => {
                const selectedOption = userAnswers[q.id];
                const isGraded = !!gradingResult;
                const resultItem = gradingResult?.results.find(r => r.id === q.id);

                return (
                  <div
                    key={q.id}
                    className="p-5 sm:p-6 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4 transition-colors"
                  >
                    {/* Question Title */}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-bold text-xs shrink-0 mt-0.5">
                        {qIndex + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-base font-semibold text-slate-900 leading-snug">
                          {q.question}
                        </p>
                      </div>
                    </div>

                    {/* Radio Options */}
                    <div className="grid grid-cols-1 gap-2.5 pt-1 pl-10">
                      {q.options.map(opt => {
                        const isSelected = selectedOption === opt.label;

                        // Visual styling when graded
                        let optionStyle =
                          'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30';
                        let radioCircleStyle = 'border-slate-300 text-blue-600';

                        if (isSelected) {
                          optionStyle =
                            'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600';
                          radioCircleStyle = 'border-blue-600 bg-blue-600 text-white';
                        }

                        if (isGraded && resultItem) {
                          if (opt.label === resultItem.correctChoice) {
                            optionStyle =
                              'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600';
                            radioCircleStyle =
                              'border-emerald-600 bg-emerald-600 text-white';
                          } else if (isSelected && !resultItem.isCorrect) {
                            optionStyle =
                              'border-red-500 bg-red-50/70 ring-1 ring-red-500';
                            radioCircleStyle = 'border-red-500 bg-red-500 text-white';
                          } else {
                            optionStyle = 'opacity-60 border-slate-200 bg-white';
                          }
                        }

                        return (
                          <label
                            key={opt.label}
                            htmlFor={`q-${q.id}-opt-${opt.label}`}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all cursor-pointer ${optionStyle} ${
                              isGraded ? 'cursor-default' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              id={`q-${q.id}-opt-${opt.label}`}
                              name={`question-${q.id}`}
                              value={opt.label}
                              checked={isSelected}
                              disabled={isGraded}
                              onChange={() => handleSelectOption(q.id, opt.label)}
                              className="sr-only"
                            />
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${radioCircleStyle}`}
                            >
                              {opt.label}
                            </div>
                            <div className="flex-1">
                              <span className="text-slate-800 leading-relaxed font-normal">
                                {opt.text}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submission Section */}
            {!gradingResult && (
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  {allAnswered ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      All 3 questions answered. Ready to submit!
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      Please answer all questions before submitting ({answeredCount}/3 answered).
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmitAnswers}
                  disabled={isSubmitting || !allAnswered}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:bg-slate-300 text-white font-semibold text-sm rounded-xl shadow-xs transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Grading Responses...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Answers</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Section 3: Results & Feedback Card */}
        {gradingResult && (
          <section
            ref={resultsCardRef}
            className="bg-white border-2 border-slate-300 rounded-2xl p-6 sm:p-8 shadow-md space-y-6 scroll-mt-20 animate-in fade-in duration-300"
          >
            {/* Header / Score Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    Results & Assessment Feedback
                  </h3>
                </div>
                <p className="text-sm text-slate-600">
                  Graded strictly against your supplied ARIN 121 study material.
                </p>
              </div>

              {/* Prominent Score Display */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-medium">Final Score</div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {gradingResult.scoreText}
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                    gradingResult.score === gradingResult.total
                      ? 'bg-emerald-100 text-emerald-800'
                      : gradingResult.score > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {Math.round((gradingResult.score / gradingResult.total) * 100)}%
                </div>
              </div>
            </div>

            {/* Explanations & Itemized Breakdown */}
            <div className="space-y-5">
              <h4 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                Detailed Question Assessment
              </h4>

              <div className="space-y-4">
                {gradingResult.results.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-5 rounded-xl border ${
                      item.isCorrect
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-red-50/30 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-xs font-bold text-slate-700 shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.question}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                            <span>
                              Your response:{' '}
                              <strong className="text-slate-800">
                                Option {item.userChoice}
                              </strong>{' '}
                              ({item.userChoiceText})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="shrink-0">
                        {item.isCorrect ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Correct</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-100 text-red-800 text-xs font-bold">
                            <XCircle className="w-3.5 h-3.5 text-red-700" />
                            <span>Incorrect</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Explanations for Incorrect or Review */}
                    <div className="mt-4 pt-3 border-t border-slate-200/80 text-xs space-y-2">
                      {!item.isCorrect ? (
                        <>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-slate-900">Correct Choice:</span>
                            <span className="text-emerald-800 font-semibold">
                              Option {item.correctChoice} — {item.correctChoiceText}
                            </span>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                            <span className="font-semibold text-slate-900 block mb-0.5">
                              Explanation from Study Material:
                            </span>
                            {item.explanation}
                          </div>
                        </>
                      ) : (
                        <div className="text-emerald-800 leading-relaxed font-medium">
                          <span>✓ Verified by source text: </span>
                          <span className="text-slate-700 font-normal">{item.explanation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions: Retake or Generate New */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetakeQuiz}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-xl border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Retake This Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>Edit Notes & Generate New Quiz</span>
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ARIN 121 · Department of Artificial Intelligence & Reasoning</span>
          <span>Single-page Interactive Study Quiz System</span>
        </div>
      </footer>
    </div>
  );
}
