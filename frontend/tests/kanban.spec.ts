import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/auth/login", {
    data: { username: "user", password: "password" },
  });
});

test("loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card").first()).toBeVisible();
});

test("card persists after reload", async ({ page }) => {
  const title = `Persist-${Date.now()}`;
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(title)).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-testid^="column-"]').first().getByText(title)).toBeVisible();
});

test("column rename persists after reload", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const titleInput = firstColumn.getByLabel("Column title");
  await titleInput.fill("Renamed");
  const responsePromise = page.waitForResponse("**/api/board/columns/**");
  await titleInput.press("Tab");
  await responsePromise;

  await page.reload();
  await expect(
    page.locator('[data-testid^="column-"]').first().getByLabel("Column title")
  ).toHaveValue("Renamed");

  // Restore so subsequent runs start from "Backlog"
  const restoreInput = page.locator('[data-testid^="column-"]').first().getByLabel("Column title");
  await restoreInput.fill("Backlog");
  const restoreResponse = page.waitForResponse("**/api/board/columns/**");
  await restoreInput.press("Tab");
  await restoreResponse;
});

test("deleted card stays gone after reload", async ({ page }) => {
  const title = `Delete-${Date.now()}`;
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByRole("button", { name: /add card/i }).click();

  // Scope the card article by its unique title
  await expect(firstColumn.getByText(title)).toBeVisible();

  // aria-label="Delete {title}" is on the <button> only — not on the dnd-kit article
  const deleteResponse = page.waitForResponse("**/api/board/cards/**");
  await page.locator(`[aria-label="Delete ${title}"]`).click();
  await deleteResponse;

  await page.reload();
  await expect(page.getByText(title)).not.toBeVisible();
});

test("opens and closes the AI sidebar", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-testid^="column-"]');

  await page.getByRole("button", { name: /toggle ai sidebar/i }).click();
  await expect(page.getByPlaceholder(/ask ai/i)).toBeVisible();

  await page.getByRole("button", { name: /toggle ai sidebar/i }).click();
  await expect(page.getByPlaceholder(/ask ai/i)).not.toBeVisible();
});

test("sends a message via AI sidebar and receives a reply", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-testid^="column-"]');

  await page.getByRole("button", { name: /toggle ai sidebar/i }).click();
  await page.getByPlaceholder(/ask ai/i).fill("Reply with exactly: hello");
  await page.getByRole("button", { name: "Send" }).click();

  // User message appears immediately
  await expect(page.getByTestId("message").first()).toContainText("Reply with exactly: hello");
  // Loading indicator visible
  await expect(page.getByText(/thinking/i)).toBeVisible();
  // AI reply eventually appears (real API call — up to 40s)
  await expect(page.getByTestId("message").nth(1)).not.toContainText(/thinking/i, { timeout: 40000 });
  await expect(page.getByTestId("message")).toHaveCount(2, { timeout: 40000 });
});

test("moves a card between columns", async ({ page }) => {
  const title = `Drag-${Date.now()}`;
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(title);
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText(title)).toBeVisible();

  const card = firstColumn.getByText(title);
  const targetColumn = page.getByTestId("column-col-review");

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByText(title)).toBeVisible();
});
