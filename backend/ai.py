import json
import os

from openai import OpenAI
from pydantic import BaseModel

_MODEL = "openai/gpt-oss-120b"
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


# --- public API ---

def ask(prompt: str) -> str:
    response = _client().chat.completions.create(
        model=_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def chat(board: dict, history: list[dict], message: str) -> AIResponse:
    system_prompt = (
        "You are a Kanban board assistant. The current board state is:\n\n"
        + json.dumps(board, indent=2)
        + "\n\nYou MUST reply with a JSON object matching this schema exactly:\n"
        '{"message": "<your reply>", "board_update": {"add_cards": [{"column_id": "...", "title": "...", "details": "..."}], '
        '"move_cards": [{"card_id": "...", "column_id": "...", "position": 0}], '
        '"delete_card_ids": ["..."], "rename_columns": [{"column_id": "...", "title": "..."}]}}\n\n'
        "Set board_update to null if no board changes are needed. "
        "Only include list items that should actually change. "
        "Use only column/card IDs that exist in the board state above."
    )
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
