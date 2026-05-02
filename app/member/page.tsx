"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Task = {
  rowNumber: number;
  taskName: string;
  taskType: "Daily" | "Weekly" | "One-time";
  assignedTo: string;
  plannedDate: string;
  actualCompletionDate: string;
  status: "Pending" | "Done";
  weeklyScore: number;
};

type Stats = {
  member: string;
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  completedTasks: number;
  lateTasks: number;
  missedTasks: number;
  score: number;
};

type TodayResponse = {
  memberName: string;
  tasks: Task[];
  stats: Stats;
  error?: string;
};

export default function MemberPage() {
  const searchParams = useSearchParams();
  const memberName = searchParams.get("name")?.trim() ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [coachMessage, setCoachMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRow, setIsSubmittingRow] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadTasks() {
    if (!memberName) {
      setError("Add a member name in the URL, for example `/member?name=Alice`.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/tasks/today?name=${encodeURIComponent(memberName)}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as TodayResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load tasks.");
      }

      setTasks(data.tasks);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, [memberName]);

  const recurringTasks = useMemo(
    () => tasks.filter((task) => task.taskType === "Daily" || task.taskType === "Weekly"),
    [tasks]
  );
  const oneTimeTasks = useMemo(() => tasks.filter((task) => task.taskType === "One-time"), [tasks]);

  async function handleMarkDone(rowNumber: number) {
    setIsSubmittingRow(rowNumber);
    setError("");

    try {
      const response = await fetch("/api/tasks/mark-done", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rowNumber })
      });

      const data = (await response.json()) as {
        error?: string;
        coachMessage?: string;
        stats?: Stats;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to update task.");
      }

      setCoachMessage(data.coachMessage || "");
      if (data.stats) {
        setStats(data.stats);
      }
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    } finally {
      setIsSubmittingRow(null);
    }
  }

  return (
    <main className="page-shell">
      <section className="card">
        <div className="header-row">
          <div>
            <span className="badge">Today&apos;s Tasks</span>
            <h1>{memberName || "Team member"}</h1>
          </div>
          <button className="secondary-button" onClick={() => void loadTasks()} type="button">
            Refresh
          </button>
        </div>

        <p className="hero-copy">Only pending tasks due today are shown here. Marking a task done updates Google Sheets instantly.</p>

        {stats ? (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Week score</span>
              <strong>{stats.score}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Completed</span>
              <strong>{stats.completedTasks}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Late</span>
              <strong>{stats.lateTasks}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Missed</span>
              <strong>{stats.missedTasks}</strong>
            </div>
          </div>
        ) : null}

        {coachMessage ? <div className="coach-box">{coachMessage}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
      </section>

      <TaskSection
        title="Recurring tasks"
        emptyMessage="No daily or weekly tasks due today."
        tasks={recurringTasks}
        isLoading={isLoading}
        isSubmittingRow={isSubmittingRow}
        onMarkDone={handleMarkDone}
      />

      <TaskSection
        title="One-time tasks"
        emptyMessage="No one-time tasks due today."
        tasks={oneTimeTasks}
        isLoading={isLoading}
        isSubmittingRow={isSubmittingRow}
        onMarkDone={handleMarkDone}
      />
    </main>
  );
}

function TaskSection({
  title,
  emptyMessage,
  tasks,
  isLoading,
  isSubmittingRow,
  onMarkDone
}: {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  isLoading: boolean;
  isSubmittingRow: number | null;
  onMarkDone: (rowNumber: number) => Promise<void>;
}) {
  return (
    <section className="card">
      <div className="section-header">
        <h2>{title}</h2>
        <span>{tasks.length}</span>
      </div>

      {isLoading ? <p className="muted-copy">Loading tasks...</p> : null}
      {!isLoading && tasks.length === 0 ? <p className="muted-copy">{emptyMessage}</p> : null}

      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-card" key={task.rowNumber}>
            <div className="task-meta">
              <span className="task-type">{task.taskType}</span>
              <span className="task-date">{task.plannedDate}</span>
            </div>
            <h3>{task.taskName}</h3>
            <button
              className="primary-button"
              disabled={isSubmittingRow === task.rowNumber}
              onClick={() => void onMarkDone(task.rowNumber)}
              type="button"
            >
              {isSubmittingRow === task.rowNumber ? "Updating..." : "Mark as Done"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
