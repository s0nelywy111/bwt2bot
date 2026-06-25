import asyncio
import os
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher
from aiogram.types import Message

dp = Dispatcher()

@dp.message()
async def any_message(
    message: Message,
):
    await message.answer("Hello") 

async def main():
    load_dotenv()
    token = os.getenv("BOT_TOKEN")
    if not token:
        error = "No token provided"
        raise ValueError(error)
    bot =  Bot(token=token)
    
    print("[Start] Bot has running...")
    try:
        await dp.start_polling(bot)
    finally:
        print('[Stop] Bot has stopped')


if __name__ == "__main__":
    asyncio.run(main())