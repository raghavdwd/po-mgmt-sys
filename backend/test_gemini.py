import asyncio
from google import genai
import os

async def main():
    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say hi"
        )
        print("GenAI OK:", resp.text)
    except Exception as e:
        print("Error:", e)

asyncio.run(main())
