import type { BoardData, Card } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(public status: number) {
    super(`API error: ${status}`);
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, { credentials: "include", ...init });
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

const json = (body: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// --- Auth (return raw Response so callers can inspect res.ok) ---

export const getMe = () => request("/api/auth/me");

export const login = (username: string, password: string) =>
  request("/api/auth/login", { method: "POST", ...json({ username, password }) });

export const logout = () => request("/api/auth/logout", { method: "POST" });

// --- Board (throw ApiError on non-ok) ---

export const getBoard = (): Promise<BoardData> => requestJson("/api/board");

export const renameColumn = (columnId: string, title: string): Promise<void> =>
  requestJson(`/api/board/columns/${columnId}`, { method: "PUT", ...json({ title }) });

export const createCard = (
  columnId: string,
  title: string,
  details: string
): Promise<Card> =>
  requestJson("/api/board/cards", {
    method: "POST",
    ...json({ column_id: columnId, title, details }),
  });

export const deleteCard = (cardId: string): Promise<void> =>
  requestJson(`/api/board/cards/${cardId}`, { method: "DELETE" });

export const moveCard = (
  cardId: string,
  columnId: string,
  position: number
): Promise<void> =>
  requestJson(`/api/board/cards/${cardId}/move`, {
    method: "PUT",
    ...json({ column_id: columnId, position }),
  });

// --- AI ---

export type ChatResponse = {
  message: string;
  board_update: Record<string, unknown> | null;
  board: BoardData;
};

export const aiChat = (
  message: string,
  history: { role: string; content: string }[]
): Promise<ChatResponse> =>
  requestJson("/api/ai/chat", {
    method: "POST",
    ...json({ message, history }),
  });
