import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/api";
import { AISidebar } from "@/components/AISidebar";
import type { BoardData } from "@/lib/kanban";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, aiChat: vi.fn() };
});

const emptyBoard: BoardData = {
  columns: [{ id: "col-backlog", title: "Backlog", cardIds: [] }],
  cards: {},
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("AISidebar", () => {
  it("renders input and send button", () => {
    render(<AISidebar onBoardUpdate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/ask ai/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("sends message and shows AI reply in thread", async () => {
    vi.mocked(api.aiChat).mockResolvedValue({
      message: "AI reply here",
      board_update: null,
      board: emptyBoard,
    });
    render(<AISidebar onBoardUpdate={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("Hello")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("AI reply here")).toBeInTheDocument()
    );
  });

  it("shows loading state and disables input while awaiting response", async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.aiChat).mockReturnValue(new Promise((r) => { resolve = r; }) as ReturnType<typeof api.aiChat>);

    render(<AISidebar onBoardUpdate={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "test");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    // loading indicator: animated dots appear in a message bubble
    expect(screen.getAllByTestId("message").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText(/ask ai/i)).toBeDisabled();

    resolve({ message: "done", board_update: null, board: emptyBoard });
  });

  it("calls onBoardUpdate when board_update is non-null", async () => {
    const onBoardUpdate = vi.fn();
    const updatedBoard: BoardData = {
      columns: [{ id: "col-backlog", title: "Backlog", cardIds: ["card-ai"] }],
      cards: { "card-ai": { id: "card-ai", title: "AI Card", details: "" } },
    };
    vi.mocked(api.aiChat).mockResolvedValue({
      message: "Added a card",
      board_update: { add_cards: [{ column_id: "col-backlog", title: "AI Card", details: "" }], move_cards: [], delete_card_ids: [], rename_columns: [] },
      board: updatedBoard,
    });
    render(<AISidebar onBoardUpdate={onBoardUpdate} />);
    await userEvent.type(screen.getByPlaceholderText(/ask ai/i), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalledWith(updatedBoard));
  });
});
