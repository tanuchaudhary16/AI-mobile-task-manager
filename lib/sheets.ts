import { google, sheets_v4 } from "googleapis";

export type TaskType = "Daily" | "Weekly" | "One-time";
export type TaskStatus = "Pending" | "Done";

type HeaderKey =
  | "Task name"
  | "Task type"
  | "Assigned to"
  | "Planned date"
  | "Actual completion date"
  | "Status"
  | "Weekly score";

export type TaskRow = {
  rowNumber: number;
  taskName: string;
  taskType: TaskType;
  assignedTo: string;
  plannedDate: string;
  actualCompletionDate: string;
  status: TaskStatus;
  weeklyScore: number;
};

export type CoachStats = {
  member: string;
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  completedTasks: number;
  lateTasks: number;
  missedTasks: number;
  score: number;
};

const REQUIRED_HEADERS: HeaderKey[] = [
  "Task name",
  "Task type",
  "Assigned to",
  "Planned date",
  "Actual completion date",
  "Status",
  "Weekly score"
];

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPrivateKey(): string {
  return getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getSheetName(): string {
  return process.env.GOOGLE_SHEET_NAME?.trim() || "Sheet1";
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_CLIENT_EMAIL"),
      private_key: getPrivateKey()
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({
    version: "v4",
    auth
  });
}

async function getRawValues(): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEET_ID"),
    range: `${getSheetName()}!A:G`
  });

  return (response.data.values ?? []).map((row) => row.map((cell) => `${cell ?? ""}`));
}

function mapHeaders(headerRow: string[]): Record<HeaderKey, number> {
  const indexes = {} as Record<HeaderKey, number>;

  for (const header of REQUIRED_HEADERS) {
    const idx = headerRow.findIndex((item) => item.trim() === header);

    if (idx === -1) {
      throw new Error(`Missing required sheet header: ${header}`);
    }

    indexes[header] = idx;
  }

  return indexes;
}

function normalizeDate(value: string): string {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDate(parsed);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDate(dateText: string): Date {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getTodayDate(): string {
  return formatDate(new Date());
}

export function addDays(dateText: string, days: number): string {
  const next = parseDate(dateText);
  next.setDate(next.getDate() + days);
  return formatDate(next);
}

function getWeekStart(dateText: string): string {
  const date = parseDate(dateText);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDate(date);
}

function getWeekEnd(dateText: string): string {
  return addDays(getWeekStart(dateText), 6);
}

export async function getAllTasks(): Promise<TaskRow[]> {
  const values = await getRawValues();

  if (values.length === 0) {
    return [];
  }

  const headerIndexes = mapHeaders(values[0]);

  return values.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    taskName: row[headerIndexes["Task name"]] ?? "",
    taskType: (row[headerIndexes["Task type"]] ?? "One-time") as TaskType,
    assignedTo: row[headerIndexes["Assigned to"]] ?? "",
    plannedDate: normalizeDate(row[headerIndexes["Planned date"]] ?? ""),
    actualCompletionDate: normalizeDate(row[headerIndexes["Actual completion date"]] ?? ""),
    status: (row[headerIndexes["Status"]] ?? "Pending") as TaskStatus,
    weeklyScore: Number(row[headerIndexes["Weekly score"]] ?? 0) || 0
  }));
}

export async function getTasksForToday(memberName: string): Promise<TaskRow[]> {
  const today = getTodayDate();
  const normalizedName = memberName.trim().toLowerCase();
  const tasks = await getAllTasks();

  return tasks.filter(
    (task) =>
      task.assignedTo.trim().toLowerCase() === normalizedName &&
      task.plannedDate === today &&
      task.status === "Pending"
  );
}

function toRowValues(task: Omit<TaskRow, "rowNumber">): string[] {
  return [
    task.taskName,
    task.taskType,
    task.assignedTo,
    task.plannedDate,
    task.actualCompletionDate,
    task.status,
    `${task.weeklyScore}`
  ];
}

export async function updateTaskRow(rowNumber: number, task: Omit<TaskRow, "rowNumber">): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getEnv("GOOGLE_SHEET_ID"),
    range: `${getSheetName()}!A${rowNumber}:G${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [toRowValues(task)]
    }
  });
}

export async function appendTaskRow(task: Omit<TaskRow, "rowNumber">): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getEnv("GOOGLE_SHEET_ID"),
    range: `${getSheetName()}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [toRowValues(task)]
    }
  });
}

function getScoreForTask(task: Pick<TaskRow, "plannedDate" | "actualCompletionDate" | "status">, today: string): number {
  if (task.status === "Done" && task.actualCompletionDate && task.actualCompletionDate > task.plannedDate) {
    return -5;
  }

  if (task.status === "Pending" && task.plannedDate < today) {
    return -5;
  }

  return 0;
}

export async function recomputeWeeklyScoresForMember(memberName: string, anchorDate: string): Promise<CoachStats> {
  const allTasks = await getAllTasks();
  const weekStart = getWeekStart(anchorDate);
  const weekEnd = getWeekEnd(anchorDate);
  const today = getTodayDate();
  const targetName = memberName.trim().toLowerCase();

  const weekTasks = allTasks.filter((task) => {
    const assignedMatch = task.assignedTo.trim().toLowerCase() === targetName;
    const inRange = task.plannedDate >= weekStart && task.plannedDate <= weekEnd;
    return assignedMatch && inRange;
  });

  for (const task of weekTasks) {
    const nextScore = getScoreForTask(task, today);
    if (nextScore !== task.weeklyScore) {
      await updateTaskRow(task.rowNumber, {
        taskName: task.taskName,
        taskType: task.taskType,
        assignedTo: task.assignedTo,
        plannedDate: task.plannedDate,
        actualCompletionDate: task.actualCompletionDate,
        status: task.status,
        weeklyScore: nextScore
      });
      task.weeklyScore = nextScore;
    }
  }

  const lateTasks = weekTasks.filter(
    (task) => task.status === "Done" && task.actualCompletionDate && task.actualCompletionDate > task.plannedDate
  ).length;
  const missedTasks = weekTasks.filter((task) => task.status === "Pending" && task.plannedDate < today).length;
  const completedTasks = weekTasks.filter((task) => task.status === "Done").length;
  const score = weekTasks.reduce((sum, task) => sum + task.weeklyScore, 0);

  return {
    member: memberName,
    weekStart,
    weekEnd,
    totalTasks: weekTasks.length,
    completedTasks,
    lateTasks,
    missedTasks,
    score
  };
}

export async function markTaskDone(rowNumber: number): Promise<{ updatedTask: TaskRow; stats: CoachStats }> {
  const tasks = await getAllTasks();
  const task = tasks.find((item) => item.rowNumber === rowNumber);

  if (!task) {
    throw new Error("Task not found.");
  }

  if (task.status === "Done") {
    const stats = await recomputeWeeklyScoresForMember(task.assignedTo, task.plannedDate);
    return { updatedTask: task, stats };
  }

  const completionDate = getTodayDate();
  const updatedTask: TaskRow = {
    ...task,
    actualCompletionDate: completionDate,
    status: "Done"
  };

  await updateTaskRow(rowNumber, {
    taskName: updatedTask.taskName,
    taskType: updatedTask.taskType,
    assignedTo: updatedTask.assignedTo,
    plannedDate: updatedTask.plannedDate,
    actualCompletionDate: updatedTask.actualCompletionDate,
    status: updatedTask.status,
    weeklyScore: getScoreForTask(updatedTask, completionDate)
  });

  if (task.taskType === "Daily" || task.taskType === "Weekly") {
    await appendTaskRow({
      taskName: task.taskName,
      taskType: task.taskType,
      assignedTo: task.assignedTo,
      plannedDate: addDays(task.plannedDate, task.taskType === "Daily" ? 1 : 7),
      actualCompletionDate: "",
      status: "Pending",
      weeklyScore: 0
    });
  }

  const stats = await recomputeWeeklyScoresForMember(task.assignedTo, task.plannedDate);
  return { updatedTask: { ...updatedTask, weeklyScore: getScoreForTask(updatedTask, completionDate) }, stats };
}
