import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
client = OpenAI(api_key=API_KEY) if API_KEY else None

with (Path(__file__).parent / "knowledge_base.json").open("r", encoding="utf-8") as file:
    knowledge_base = json.load(file)


def offline_response(message):
    msg = message.lower()
    matches = [item for item in knowledge_base if item["question"].lower() in msg]
    if matches:
        return max(matches, key=lambda item: len(item["question"]))["answer"]
    return "I am currently running in offline mode. Please ask another question."


def get_response(message, history=None):
    if client:
        try:
            messages = [{"role": "system", "content": "You are a helpful AI assistant."}]
            for item in history or []:
                messages.append({"role": "user" if item["sender"] == "user" else "assistant", "content": item["text"]})
            messages.append({"role": "user", "content": message})
            response = client.chat.completions.create(model=MODEL, messages=messages)
            return response.choices[0].message.content.strip()
        except Exception as error:
            print("ONLINE AI FAILED:", error)

    return offline_response(message)


def stream_response(message, history=None):
    messages = [{"role": "system", "content": "You are a helpful AI assistant. Answer clearly and use Markdown when it helps."}]
    for item in history or []:
        messages.append({
            "role": "user" if item["sender"] == "user" else "assistant",
            "content": item["text"],
        })
    messages.append({"role": "user", "content": message})

    if client:
        emitted = False
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                stream=True,
            )
            for chunk in response:
                content = chunk.choices[0].delta.content if chunk.choices else None
                if content:
                    emitted = True
                    yield content
            return
        except Exception as error:
            print("ONLINE AI STREAM FAILED:", error)
            if emitted:
                raise

    fallback = offline_response(message)
    for start in range(0, len(fallback), 24):
        yield fallback[start : start + 24]
        time.sleep(0.015)
