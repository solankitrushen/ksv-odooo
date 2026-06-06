"use client";

import { AiQuestionField } from "@/components/features/vb/quotation/ai-question-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useAnswerAiSession,
  useGenerateAiDraft,
  useStartAiSession,
} from "@/hooks/vb/use-quotation-ai";
import type {
  AiAnswerValue,
  AiQuotationSession,
  Quotation,
} from "@/lib/vb-types";
import { Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";

interface Props {
  rfqId: string;
  /** Called with the generated draft so the parent can switch to the editor. */
  onDraftGenerated: (quotation: Quotation) => void;
}

const PAGE_SIZE = 4;

export function AiCopilot({ rfqId, onDraftGenerated }: Props) {
  const start = useStartAiSession();
  const answer = useAnswerAiSession();
  const generate = useGenerateAiDraft();

  const [session, setSession] = useState<AiQuotationSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, AiAnswerValue>>({});
  const [page, setPage] = useState(0);

  const questions = useMemo(
    () => session?.questions ?? [],
    [session]
  );
  const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const pageQuestions = useMemo(
    () => questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [questions, page]
  );

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const v = answers[q.id];
        return v !== undefined && v !== null && v !== "";
      }).length,
    [questions, answers]
  );

  const handleStart = async () => {
    const res = await start.mutateAsync(rfqId);
    setSession(res.session);
    // seed any existing answers from a re-opened session
    const seeded: Record<string, AiAnswerValue> = {};
    for (const a of res.session.answers ?? []) seeded[a.questionId] = a.value;
    setAnswers(seeded);
    setPage(0);
  };

  const persistAnswers = async () => {
    if (!session) return;
    const payload = Object.entries(answers)
      .filter(([, v]) => v !== undefined)
      .map(([questionId, value]) => ({ questionId, value }));
    if (payload.length === 0) return;
    const res = await answer.mutateAsync({
      sessionId: session._id,
      answers: payload,
    });
    setSession(res.session);
  };

  const handleNext = async () => {
    await persistAnswers();
    setPage((p) => Math.min(p + 1, totalPages - 1));
  };

  const handleGenerate = async () => {
    if (!session) return;
    await persistAnswers();
    const res = await generate.mutateAsync(session._id);
    onDraftGenerated(res.quotation);
  };

  // --- intro state ----------------------------------------------------------
  if (!session) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate with AI
          </CardTitle>
          <CardDescription>
            Answer a few RFQ-specific questions and the co-pilot builds an
            editable draft. Every total is recomputed by the server — the AI
            never sets prices directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={start.isPending} onClick={handleStart}>
            <Wand2 className="h-4 w-4" />
            {start.isPending ? "Starting…" : "Start AI co-pilot"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // --- Q&A state ------------------------------------------------------------
  const isLastPage = page >= totalPages - 1;
  const progress = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI co-pilot — step {page + 1} of {totalPages}
        </CardTitle>
        <CardDescription>
          {answeredCount} of {questions.length} answered. Unanswered items are
          left unpriced; you can edit everything after generating.
        </CardDescription>
        <Progress className="mt-2" value={progress} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {pageQuestions.map((q) => (
            <AiQuestionField
              key={q.id}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              question={q}
              value={answers[q.id]}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4 dark:border-[#2a2a2a]">
          <Button
            disabled={page === 0 || answer.isPending}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            variant="outline"
          >
            Back
          </Button>
          <div className="flex gap-2">
            {!isLastPage ? (
              <Button disabled={answer.isPending} onClick={handleNext}>
                {answer.isPending ? "Saving…" : "Next"}
              </Button>
            ) : (
              <Button
                disabled={generate.isPending || answer.isPending}
                onClick={handleGenerate}
              >
                <Wand2 className="h-4 w-4" />
                {generate.isPending ? "Generating draft…" : "Generate draft"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
