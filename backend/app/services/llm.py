"""Thin wrapper around Azure OpenAI.

Two jobs: force the model to hand back parseable JSON, and record what each
call cost so the AIRun table has something useful in it.

We talk to the v1 endpoint with the stock OpenAI client, so `model` here is an
Azure *deployment* name, not a catalogue model id.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.azure_openai_api_key:
            raise RuntimeError("AZURE_OPENAI_API_KEY is not set. Copy .env.example to .env first.")
        if not settings.azure_openai_endpoint:
            raise RuntimeError("AZURE_OPENAI_ENDPOINT is not set.")
        _client = AsyncOpenAI(
            api_key=settings.azure_openai_api_key,
            base_url=settings.azure_openai_endpoint,
        )
    return _client


@dataclass
class LLMResult:
    text: str
    data: dict[str, Any] = field(default_factory=dict)
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    """Pull a JSON object out of a model reply, fences or no fences."""
    candidate = text.strip()

    match = _FENCE.search(candidate)
    if match:
        candidate = match.group(1).strip()

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Fall back to the outermost {...} span.
    start, end = candidate.find("{"), candidate.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(candidate[start : end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError(f"Model did not return valid JSON: {exc}") from exc
    raise ValueError("Model did not return any JSON object.")


async def complete(
    *,
    system: str,
    user: str,
    model: str | None = None,
    max_tokens: int = 8000,
    expect_json: bool = True,
    image_data_url: str | None = None,
) -> LLMResult:
    """One chat completion.

    No temperature knob on purpose: the gpt-5 deployments are reasoning models
    and reject anything but the default. `max_tokens` maps to
    max_completion_tokens, which reasoning tokens also draw from — so keep it
    generous or the visible answer comes back empty.

    `image_data_url` sends a "data:image/...;base64,..." string alongside the
    text — the chat completions vision format, an array of typed parts
    instead of a plain string. Pass a vision-capable deployment as `model`;
    Azure doesn't reject a non-vision one client-side, it just fails at call
    time, and confusingly.
    """
    started = time.perf_counter()
    user_content: str | list[dict[str, Any]] = user
    if image_data_url:
        user_content = [
            {"type": "text", "text": user},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ]
    kwargs: dict[str, Any] = {
        "model": model or settings.azure_openai_deployment,
        "max_completion_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    if expect_json:
        # Replaces the old assistant-prefill trick; the OpenAI API has no prefill.
        # Requires the word "json" somewhere in the messages, which the system
        # prompts in prompts.py all satisfy.
        kwargs["response_format"] = {"type": "json_object"}
    if settings.azure_openai_reasoning_effort:
        kwargs["reasoning_effort"] = settings.azure_openai_reasoning_effort

    response = await client().chat.completions.create(**kwargs)

    choice = response.choices[0]
    text = choice.message.content or ""
    if not text.strip():
        raise RuntimeError(
            f"Model returned an empty reply (finish_reason={choice.finish_reason!r}). "
            "If that is 'length', raise max_tokens — reasoning tokens count against it."
        )

    usage = response.usage
    result = LLMResult(
        text=text,
        model=response.model,
        input_tokens=usage.prompt_tokens if usage else 0,
        output_tokens=usage.completion_tokens if usage else 0,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    if expect_json:
        result.data = extract_json(text)
    return result
