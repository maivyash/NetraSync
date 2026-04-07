const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STORAGE_PREFIX = "netrasync_weekly_progress_v1";

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonday(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);
  const offsetFromMonday = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - offsetFromMonday);
  return localDate;
}

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || "guest"}`;
}

function readWeeklyProgress(userId) {
  const key = getStorageKey(userId);
  const raw = window.localStorage.getItem(key);
  const currentWeekStart = toDateKey(getMonday(new Date()));

  if (!raw) {
    return {
      weekStart: currentWeekStart,
      days: {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.weekStart !== currentWeekStart || typeof parsed.days !== "object") {
      return {
        weekStart: currentWeekStart,
        days: {},
      };
    }
    return parsed;
  } catch {
    return {
      weekStart: currentWeekStart,
      days: {},
    };
  }
}

function writeWeeklyProgress(userId, payload) {
  const key = getStorageKey(userId);
  window.localStorage.setItem(key, JSON.stringify(payload));
}

export function recordDailyPracticeScore({ userId, gameId, score }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const data = readWeeklyProgress(userId);

  const today = new Date();
  const dateKey = toDateKey(today);
  const current = data.days[dateKey] || { total: 0, sessions: 0, lastGame: null };

  data.days[dateKey] = {
    total: Number(current.total || 0) + safeScore,
    sessions: Number(current.sessions || 0) + 1,
    lastGame: gameId || current.lastGame || "unknown",
  };

  writeWeeklyProgress(userId, data);
}

export function getCurrentWeekProgress(userId) {
  const data = readWeeklyProgress(userId);
  const monday = getMonday(new Date());
  const todayIndex = (new Date().getDay() + 6) % 7;

  return WEEK_DAYS.map((dayLabel, dayIndex) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayIndex);
    const dateKey = toDateKey(date);
    const entry = data.days[dateKey];

    if (dayIndex > todayIndex) {
      return {
        dayLabel,
        dateKey,
        value: null,
        isFuture: true,
        hasData: false,
      };
    }

    if (!entry || !entry.sessions) {
      return {
        dayLabel,
        dateKey,
        value: null,
        isFuture: false,
        hasData: false,
      };
    }

    return {
      dayLabel,
      dateKey,
      value: Math.round(entry.total / entry.sessions),
      isFuture: false,
      hasData: true,
    };
  });
}

export function getWeekAverage(progressList) {
  const playedValues = (progressList || [])
    .filter((item) => item && typeof item.value === "number")
    .map((item) => item.value);

  if (!playedValues.length) return 0;
  return Math.round(playedValues.reduce((sum, value) => sum + value, 0) / playedValues.length);
}
