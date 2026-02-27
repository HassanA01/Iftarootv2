import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQuiz, createQuiz, updateQuiz } from "../api/quizzes";
import type { Quiz } from "../types";
import type { QuestionInput } from "../api/quizzes";

interface OptionDraft {
  text: string;
  is_correct: boolean;
}

interface QuestionDraft {
  text: string;
  time_limit: number;
  options: OptionDraft[];
}

function blankOption(): OptionDraft {
  return { text: "", is_correct: false };
}

function blankQuestion(): QuestionDraft {
  return { text: "", time_limit: 20, options: [blankOption(), blankOption()] };
}

// ── Inner form — only mounted once initial data is available ─────────────────

interface QuizFormProps {
  quizID?: string;
  initial: { title: string; questions: QuestionDraft[] };
}

function QuizForm({ quizID, initial }: QuizFormProps) {
  const isEdit = !!quizID;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initial.title);
  const [questions, setQuestions] = useState<QuestionDraft[]>(initial.questions);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { title: string; questions: QuestionInput[] }) =>
      isEdit ? updateQuiz(quizID!, input) : createQuiz(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["quiz", quizID] });
      navigate("/admin/quizzes");
    },
  });

  function validate(): string | null {
    if (!title.trim()) return "Quiz title is required.";
    if (questions.length === 0) return "Add at least one question.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Question ${i + 1} needs text.`;
      if (q.options.length < 2 || q.options.length > 4)
        return `Question ${i + 1} must have 2–4 options.`;
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim())
          return `Question ${i + 1}, option ${j + 1} needs text.`;
      }
      const correctCount = q.options.filter((o) => o.is_correct).length;
      if (correctCount !== 1)
        return `Question ${i + 1} must have exactly one correct option.`;
    }
    return null;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(null);
    mutation.mutate({
      title: title.trim(),
      questions: questions.map((q, i) => ({
        text: q.text.trim(),
        time_limit: q.time_limit,
        order: i + 1,
        options: q.options.map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })),
      })),
    });
  }

  function updateQuestion(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  }

  function updateOption(qIdx: number, oIdx: number, patch: Partial<OptionDraft>) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i !== qIdx
          ? q
          : { ...q, options: q.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) }
      )
    );
  }

  function setCorrect(qIdx: number, oIdx: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i !== qIdx
          ? q
          : { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oIdx })) }
      )
    );
  }

  function addOption(qIdx: number) {
    setQuestions((qs) =>
      qs.map((q, i) => (i !== qIdx ? q : { ...q, options: [...q.options, blankOption()] }))
    );
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i !== qIdx ? q : { ...q, options: q.options.filter((_, j) => j !== oIdx) }
      )
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{isEdit ? "Edit quiz" : "New quiz"}</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Quiz title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            placeholder="e.g. General Knowledge"
          />
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-gray-900 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-300">
                  Question {qIdx + 1}
                </span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                type="text"
                required
                value={q.text}
                onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                placeholder="Question text"
              />

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400 whitespace-nowrap">Time limit (s)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={q.time_limit}
                  onChange={(e) => updateQuestion(qIdx, { time_limit: Number(e.target.value) })}
                  className="w-24 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="space-y-2">
                {q.options.map((o, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`correct-${qIdx}`}
                      checked={o.is_correct}
                      onChange={() => setCorrect(qIdx, oIdx)}
                      className="accent-indigo-500 shrink-0"
                      title="Mark as correct"
                    />
                    <input
                      type="text"
                      required
                      value={o.text}
                      onChange={(e) => updateOption(qIdx, oIdx, { text: e.target.value })}
                      className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                      placeholder={`Option ${oIdx + 1}`}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(qIdx, oIdx)}
                        className="text-xs text-gray-500 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 4 && (
                  <button
                    type="button"
                    onClick={() => addOption(qIdx)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition mt-1"
                  >
                    + Add option
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="w-full border border-dashed border-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 rounded-xl py-3 text-sm transition"
          >
            + Add question
          </button>
        </div>

        {(formError || mutation.isError) && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {formError ??
              (mutation.error as { response?: { data?: { error?: string } } })?.response?.data
                ?.error ??
              "Something went wrong. Please try again."}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2.5 text-sm transition"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create quiz"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/quizzes")}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Page wrapper — handles routing and load state ────────────────────────────

function quizToInitial(quiz: Quiz) {
  return {
    title: quiz.title,
    questions:
      quiz.questions && quiz.questions.length > 0
        ? quiz.questions.map((q) => ({
            text: q.text,
            time_limit: q.time_limit,
            options: q.options.map((o) => ({ text: o.text, is_correct: !!o.is_correct })),
          }))
        : [blankQuestion()],
  };
}

export function QuizFormPage() {
  const { quizID } = useParams<{ quizID: string }>();
  const isEdit = !!quizID;

  const { data: existing, isLoading, isError } = useQuery({
    queryKey: ["quiz", quizID],
    queryFn: () => getQuiz(quizID!),
    enabled: isEdit,
  });

  if (isEdit && isLoading) {
    return <div className="text-gray-400 py-12 text-center">Loading quiz…</div>;
  }

  if (isEdit && (isError || !existing)) {
    return <div className="text-red-400 py-12 text-center">Quiz not found.</div>;
  }

  const initial = existing
    ? quizToInitial(existing)
    : { title: "", questions: [blankQuestion()] };

  return <QuizForm quizID={quizID} initial={initial} />;
}
