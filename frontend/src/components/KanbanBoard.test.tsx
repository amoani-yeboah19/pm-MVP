import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/api";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getBoard: vi.fn(),
    renameColumn: vi.fn(),
    createCard: vi.fn(),
    deleteCard: vi.fn(),
    moveCard: vi.fn(),
    aiChat: vi.fn(),
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

beforeEach(() => {
  vi.mocked(api.getBoard).mockResolvedValue(emptyBoard);
  vi.mocked(api.renameColumn).mockResolvedValue(undefined);
  vi.mocked(api.createCard).mockResolvedValue({
    id: "card-new",
    title: "New card",
    details: "",
  });
  vi.mocked(api.deleteCard).mockResolvedValue(undefined);
  vi.mocked(api.moveCard).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("KanbanBoard", () => {
  it("shows a loading indicator before board loads", () => {
    vi.mocked(api.getBoard).mockReturnValue(new Promise(() => {}));
    render(<KanbanBoard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders five columns after board loads", async () => {
    render(<KanbanBoard />);
    await waitFor(() =>
      expect(screen.getAllByTestId(/^column-/)).toHaveLength(5)
    );
    expect(api.getBoard).toHaveBeenCalledTimes(1);
  });

  it("calls onLogout when getBoard returns 401", async () => {
    vi.mocked(api.getBoard).mockRejectedValue(new api.ApiError(401));
    const onLogout = vi.fn();
    render(<KanbanBoard onLogout={onLogout} />);
    await waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("adds a card via API then renders it", async () => {
    render(<KanbanBoard />);
    const column = await screen.findByTestId("column-col-backlog");
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "New card");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() =>
      expect(api.createCard).toHaveBeenCalledWith("col-backlog", "New card", "")
    );
    expect(within(column).getByText("New card")).toBeInTheDocument();
  });

  it("renames a column and commits to API on blur", async () => {
    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");

    const input = screen.getAllByLabelText("Column title")[0];
    await userEvent.clear(input);
    await userEvent.type(input, "To Do");
    await userEvent.tab();

    await waitFor(() =>
      expect(api.renameColumn).toHaveBeenCalledWith("col-backlog", "To Do")
    );
  });

  it("deletes a card via API and removes it from view", async () => {
    vi.mocked(api.getBoard).mockResolvedValue({
      columns: [
        { id: "col-backlog", title: "Backlog", cardIds: ["card-abc"] },
        ...emptyBoard.columns.slice(1),
      ],
      cards: { "card-abc": { id: "card-abc", title: "Remove me", details: "" } },
    });

    render(<KanbanBoard />);
    await screen.findByText("Remove me");

    await userEvent.click(screen.getByRole("button", { name: /delete remove me/i }));

    await waitFor(() =>
      expect(api.deleteCard).toHaveBeenCalledWith("card-abc")
    );
    expect(screen.queryByText("Remove me")).not.toBeInTheDocument();
  });
});
