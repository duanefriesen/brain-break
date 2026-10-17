import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type Entry = { id: number; question: string; answer: string };
type Step = { entryIndex: number; revealed: boolean };
type LoadState = "loading" | "ready" | "error";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [history, setHistory] = useState<Step[]>([]);
  const [historyPosition, setHistoryPosition] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadEntries() {
      try {
        setLoadState("loading");
        const response = await fetch("/api/questions", {
          signal: controller.signal,
          headers: { Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
        });
        if (!response.ok) {
          let detail = `The spreadsheet could not be loaded (HTTP ${response.status}).`;
          try {
            const payload = await response.json() as { error?: string };
            if (payload.error) detail = payload.error;
          } catch {
            // Keep the generic HTTP error if the proxy response isn't JSON.
          }
          throw new Error(detail);
        }

        const csv = await response.text();
        if (!csv.trim()) throw new Error("The spreadsheet is empty.");

        const parsed = Papa.parse<Record<string, string>>(csv, {
          header: true,
          skipEmptyLines: "greedy",
          transformHeader: (header) => normalizeHeader(header),
        });

        if (parsed.errors.length > 0) {
          const firstError = parsed.errors[0];
          throw new Error(`The spreadsheet CSV is malformed: ${firstError.message}`);
        }

        const headers = (parsed.meta.fields ?? []).map(normalizeHeader);
        if (!headers.includes("question") || !headers.includes("answer")) {
          throw new Error('The CSV must include columns named "Question" and "Answer".');
        }

        const validEntries = parsed.data
          .map((row, index) => ({
            id: index,
            // Keep the cell text unchanged; trim only to determine whether it is blank.
            question: String(row.question ?? ""),
            answer: String(row.answer ?? ""),
          }))
          .filter((entry) => entry.question.trim().length > 0 && entry.answer.trim().length > 0);

        if (validEntries.length === 0) {
          throw new Error("No valid question-and-answer rows were found in the spreadsheet.");
        }

        setEntries(validEntries);
        const shuffled = shuffle(validEntries.map((_, index) => index));
        setOrder(shuffled);
        setHistory([{ entryIndex: 0, revealed: false }]);
        setHistoryPosition(0);
        setLoadState("ready");
        setError("");
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(
          cause instanceof Error
            ? `${cause.message} Confirm the sheet is published as CSV and try again.`
            : "An unexpected error occurred while loading the spreadsheet.",
        );
        setLoadState("error");
      }
    }

    void loadEntries();
    return () => controller.abort();
  }, []);

  const currentStep = history[historyPosition];
  const currentEntry = useMemo(
    () => (currentStep ? entries[order[currentStep.entryIndex]] : undefined),
    [currentStep, entries, order],
  );
  const isComplete = loadState === "ready" && historyPosition === order.length;

  const revealAnswer = useCallback(() => {
    setHistory((current) =>
      current.map((step, index) =>
        index === historyPosition ? { ...step, revealed: true } : step,
      ),
    );
  }, [historyPosition]);

  const nextRiddle = useCallback(() => {
    if (historyPosition >= order.length - 1) {
      setHistoryPosition(order.length);
      return;
    }
    const nextPosition = historyPosition + 1;
    setHistory((current) => {
      const nextHistory = current.slice(0, nextPosition);
      nextHistory[nextPosition] = { entryIndex: nextPosition, revealed: false };
      return nextHistory;
    });
    setHistoryPosition(nextPosition);
  }, [historyPosition, order.length]);

  const previous = useCallback(() => {
    if (historyPosition > 0) setHistoryPosition((position) => position - 1);
  }, [historyPosition]);

  const startNewRound = useCallback(() => {
    const shuffled = shuffle(entries.map((_, index) => index));
    setOrder(shuffled);
    setHistory([{ entryIndex: 0, revealed: false }]);
    setHistoryPosition(0);
  }, [entries]);

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="/" aria-label="Brain Break home">
          <span className="brand-mark" aria-hidden="true">b.</span>
          <span>brain break</span>
        </a>
        <div className="header-note"><span className="status-dot" /> A moment for your mind</div>
      </header>

      <section className="main-content" aria-labelledby="app-title">
        <div className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR DAILY PAUSE</div>
          <h1 id="app-title">Brain Break<span className="title-period">.</span></h1>
          <p className="subtitle">A little question to make you think.</p>
        </div>

        {loadState === "loading" && (
          <section className="question-card loading-card" aria-live="polite" aria-busy="true">
            <div className="loader" aria-hidden="true" />
            <p className="loading-title">Gathering a little curiosity…</p>
            <p className="muted">Loading questions from your spreadsheet</p>
          </section>
        )}

        {loadState === "error" && (
          <section className="question-card error-card" role="alert">
            <div className="error-icon" aria-hidden="true">!</div>
            <p className="card-kicker">A SMALL DETOUR</p>
            <h2>We couldn’t load your questions.</h2>
            <p className="error-copy">{error}</p>
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Try again <span aria-hidden="true">↗</span>
            </button>
          </section>
        )}

        {loadState === "ready" && !isComplete && currentEntry && (
          <section className="question-card" aria-live="polite">
            <div className="card-topline">
              <span className="card-kicker"><span className="sparkle" aria-hidden="true">✳</span> A MOMENT TO PONDER</span>
              <span className="counter">QUESTION <strong>{historyPosition + 1}</strong><span className="counter-divider">/</span>{order.length}</span>
            </div>

            <div className="progress-track" aria-label={`Question ${historyPosition + 1} of ${order.length}`}>
              <div className="progress-value" style={{ width: `${((historyPosition + 1) / order.length) * 100}%` }} />
            </div>

            <div className="question-body">
              <div className="quote-mark" aria-hidden="true">“</div>
              <h2>{currentEntry.question}</h2>
            </div>

            {currentStep.revealed && (
              <div className="answer-panel" aria-live="polite">
                <div className="answer-label"><span aria-hidden="true">✦</span> THE ANSWER</div>
                <p>{currentEntry.answer}</p>
              </div>
            )}

            <div className="card-actions">
              <button
                className="button button-secondary"
                onClick={previous}
                disabled={historyPosition === 0}
                aria-label="Go to previous question"
              >
                <span aria-hidden="true">←</span> Previous
              </button>
              {!currentStep.revealed ? (
                <button className="button button-primary" onClick={revealAnswer}>
                  Show Answer <span className="button-arrow" aria-hidden="true">↗</span>
                </button>
              ) : (
                <button className="button button-primary" onClick={nextRiddle}>
                  Next Riddle <span className="button-arrow" aria-hidden="true">→</span>
                </button>
              )}
            </div>
            <div className="card-footer">
              <span className="footer-star" aria-hidden="true">✳</span>
              <span>Take your time. There’s no rush.</span>
            </div>
          </section>
        )}

        {isComplete && (
          <section className="question-card completion-card" aria-live="polite">
            <div className="completion-icon" aria-hidden="true">✓</div>
            <p className="card-kicker">ROUND COMPLETE</p>
            <h2>You made it through<br />the whole lot.</h2>
            <p className="completion-copy">That’s {entries.length} little moments of curiosity. Ready to give your brain another spin?</p>
            <button className="button button-primary" onClick={startNewRound}>
              Start New Round <span className="button-arrow" aria-hidden="true">↻</span>
            </button>
            <button className="button button-secondary completion-back" onClick={previous}>
              <span aria-hidden="true">←</span> Previous
            </button>
          </section>
        )}

        {loadState === "ready" && (
          <p className="collection-note"><span className="note-dot" /> {entries.length} valid {entries.length === 1 ? "question" : "questions"} in your collection</p>
        )}
      </section>

      <footer className="site-footer">
        <span>MADE FOR A MOMENT OF CURIOSITY</span>
        <span className="footer-divider" />
        <span>ONE QUESTION AT A TIME</span>
      </footer>
    </main>
  );
}
