import json
import os

from openai import OpenAI
from pydantic import BaseModel

_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")
_BASE_URL = "https://openrouter.ai/api/v1"


# --- structured output models ---

class CardSpec(BaseModel):
    column_id: str
    title: str
    details: str = ""


class MoveSpec(BaseModel):
    card_id: str
    column_id: str
    position: int


class RenameSpec(BaseModel):
    column_id: str
    title: str


class BoardUpdate(BaseModel):
    add_cards: list[CardSpec] = []
    move_cards: list[MoveSpec] = []
    delete_card_ids: list[str] = []
    rename_columns: list[RenameSpec] = []


class AIResponse(BaseModel):
    message: str
    board_update: BoardUpdate | None = None


# --- helpers ---

def _client() -> OpenAI:
    return OpenAI(api_key=os.environ["OPENROUTER_API_KEY"], base_url=_BASE_URL)


def _board_summary(board: dict) -> str:
    lines = []
    for col in board["columns"]:
        cards = [
            f'  • "{board["cards"][cid]["title"]}" (id: {cid})'
            for cid in col["cardIds"]
            if cid in board["cards"]
        ]
        card_str = "\n".join(cards) if cards else "  (empty)"
        lines.append(f'Column: "{col["title"]}" (id: {col["id"]})\n{card_str}')
    return "\n\n".join(lines)


# --- public API ---

def ask(prompt: str) -> str:
    response = _client().chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def chat(board: dict, history: list[dict], message: str) -> AIResponse:
    system_prompt = f"""You are an AI assistant for Kanban Studio, a project management board.

CURRENT BOARD:
{_board_summary(board)}

You can perform these actions:
- add_cards: Add new cards to a column (provide column_id, title, optional details)
- move_cards: Move a card to a different column at a position (0 = top)
- delete_card_ids: Delete cards by ID
- rename_columns: Rename a column

RULES:
- Always write a short, friendly message in "message" explaining what you did or answering the question
- Set board_update to null if the user is just chatting or asking a question with no board change needed
- Only use column IDs and card IDs that appear in the board above — never invent them
- When adding cards, pick the most appropriate column based on context

RESPONSE FORMAT (strict JSON):
{{
  "message": "conversational reply here",
  "board_update": {{
    "add_cards": [{{"column_id": "...", "title": "...", "details": "..."}}],
    "move_cards": [{{"card_id": "...", "column_id": "...", "position": 0}}],
    "delete_card_ids": ["..."],
    "rename_columns": [{{"column_id": "...", "title": "..."}}]
  }}
}}"""

    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": message},
    ]
    response = _client().chat.completions.create(
        model=_MODEL,
        messages=messages,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return AIResponse.model_validate(data)
