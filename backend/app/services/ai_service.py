from __future__ import annotations

import logging

from google import genai

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def generate_product_description(
    product_name: str, category: str | None = None
) -> str:
    if not settings.GEMINI_API_KEY:
        return _fallback_description(product_name, category)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        category_hint = f" in the '{category}' category" if category else ""
        prompt = (
            f"Write exactly 2 sentences: a professional marketing description "
            f"for a product called '{product_name}'{category_hint}. "
            f"Be concise and compelling. No bullet points or extra formatting."
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        text = response.text or ""
        return text.strip()
    except Exception as e:
        logger.warning("Gemini API call failed: %s", e)
        return _fallback_description(product_name, category)


def _fallback_description(name: str, category: str | None) -> str:
    cat = f" {category}" if category else ""
    return (
        f"{name} is a premium{cat} product designed for reliability and performance. "
        f"Built to meet professional standards, it delivers exceptional value for businesses."
    )


async def log_ai_description_to_mongo(
    product_id: int,
    product_name: str,
    category: str | None,
    description: str,
) -> None:
    if not settings.MONGODB_URL:
        return

    try:
        import motor.motor_asyncio

        client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_DB]
        await db.ai_description_logs.insert_one(
            {
                "product_id": product_id,
                "product_name": product_name,
                "category": category,
                "generated_description": description,
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ),
            }
        )
    except Exception as e:
        logger.warning("MongoDB logging failed: %s", e)
