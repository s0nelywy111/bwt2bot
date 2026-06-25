const { Telegraf } = require('telegraf');

// Токен мы безопасно спрячем в переменных окружения Netlify
const bot = new Telegraf(process.env.BOT_TOKEN);

// Реакция на команду /start
bot.start((ctx) => ctx.reply('Привет! Я готов обновлять твой сайт.'));

// Реакция на твою кастомную команду
bot.command('update', (ctx) => {
  // Позже здесь будет код отправки данных в Supabase/Firebase
  ctx.reply('Команда получена! Передаю сигнал на сайт...');
});

// Обработчик для Netlify Functions
exports.handler = async (event) => {
  try {
    // Убеждаемся, что запрос пришел методом POST (так делает Telegram)
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Передаем сообщение от пользователя внутрь Telegraf
    const body = JSON.parse(event.body);
    await bot.handleUpdate(body);

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Ошибка в боте:', error);
    return { statusCode: 400, body: 'Error' };
  }
};