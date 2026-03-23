import asyncio
import httpx
import sys

async def main():
    async with httpx.AsyncClient() as client:
        token = sys.argv[1]
        resp = await client.post(
            "http://localhost:8000/api/purchase-orders",
            headers={"Authorization": f"Bearer {token}"},
            json={"vendor_id": 1, "items": [{"product_id": 1, "quantity": 10}]}
        )
        print(f"Status: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    asyncio.run(main())
