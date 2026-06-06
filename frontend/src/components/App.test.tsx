import { render, screen, waitFor } from "@testing-library/react";
import * as api from "@/lib/api";
import { App } from "@/components/App";
import type { BoardData } from "@/lib/kanban";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getMe: vi.fn(),
    getBoard: vi.fn(),
    logout: vi.fn(),
  };
});

const emptyBoard: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: [] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {},
};

afterEach(() => vi.clearAllMocks());

describe("App", () => {
  it("shows login page when not authenticated", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ok: false } as unknown as Response);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText("Username")).toBeInTheDocument()
    );
  });

  it("shows board when authenticated", async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ok: true } as unknown as Response);
    vi.mocked(api.getBoard).mockResolvedValue(emptyBoard);
    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByTestId(/^column-/)).toHaveLength(5)
    );
  });
});
