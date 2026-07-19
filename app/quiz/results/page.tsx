"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0";
import { QuizOutcome, QuizResponses, determineQuizOutcome, loadQuizFromStorage } from "@/types/quiz";

export default function QuizResultsPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [quiz, setQuiz] = useState<QuizResponses | null>(null);
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const syncQuizData = async () => {
      const savedQuiz = loadQuizFromStorage();

      if (!savedQuiz || !savedQuiz.completedAt) {
        router.push("/quiz");
        return;
      }

      setQuiz(savedQuiz);
      setOutcome(determineQuizOutcome(savedQuiz));

      if (user && !syncComplete) {
        try {
          const response = await fetch("/api/quiz/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizResponses: savedQuiz }),
          });

          if (response.ok) {
            setSyncComplete(true);
            setSyncFailed(false);
          } else {
            setSyncFailed(true);
          }
        } catch (error) {
          console.error("Failed to sync quiz data:", error);
          setSyncFailed(true);
        }
      }
    };

    if (!isLoading) {
      syncQuizData();
    }
  }, [user, isLoading, syncComplete, retryTick, router]);

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading your results...</div>
      </div>
    );
  }

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-8 md:py-12"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
      data-outcome={outcome ?? undefined}
    >
      {syncFailed && (
        <div className="mx-auto mt-4 max-w-2xl rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your results are saved on this device, but syncing them to your account failed.{' '}
          <button type="button" onClick={() => { setSyncFailed(false); setRetryTick((t) => t + 1); }} className="underline font-medium">
            Retry sync
          </button>
        </div>
      )}
      <div className="max-w-2xl mx-auto pt-16">
        <div className="bg-gray-900/70 border border-primary-400/30 rounded-2xl p-8 md:p-12 text-center shadow-2xl">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Your Next Step, {quiz.preferredName}</h1>
          <p className="text-gray-300 text-lg mb-6">Reset Biology provides tools and education, and sells nothing. {/* src: LMP §00 */}</p>
          <p className="text-gray-300 mb-8">Begin with the daily toolset in the portal. {/* src: LMP §00, §2.2 */}</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => router.push("/portal")}
              className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-400/20 text-lg"
            >
              Open the portal
            </button>
            <button
              onClick={() => router.push("/order")}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-secondary-400/40 text-secondary-200 font-bold py-4 px-6 rounded-lg transition-all duration-300 text-lg"
            >
              Learn about the co-op connection
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-6">If your path includes peptides, Reset Biology can connect you to the member-owned co-op. {/* src: LMP §2.2 */}</p>
        </div>
      </div>
    </main>
  );
}
