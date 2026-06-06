import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/api";
import { LoginPage } from "@/components/LoginPage";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, login: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

describe("LoginPage", () => {
  it("renders username and password fields", () => {
    render(<LoginPage onLogin={vi.fn()} />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows error message on invalid credentials", async () => {
    vi.mocked(api.login).mockResolvedValue({ ok: false } as unknown as Response);
    render(<LoginPage onLogin={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Invalid credentials.")).toBeInTheDocument();
  });

  it("calls onLogin on valid credentials", async () => {
    vi.mocked(api.login).mockResolvedValue({ ok: true } as unknown as Response);
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(onLogin).toHaveBeenCalled());
  });
});
