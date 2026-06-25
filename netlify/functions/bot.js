const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// Инициализируем бота и Supabase
const bot = new Telegraf(process.env.BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

bot.start((ctx) => ctx.reply('Привет! Напиши /update, чтобы отправить сигнал на сайт.'));

// Обработка команды /update
bot.command('update', async (ctx) => {
  try {
    // Получаем текст после команды или пишем стандартный
    const text = ctx.message.text.replace('/update', '').trim() || 'Кнопка нажата!';

    // Записываем данные в Supabase
    const { error } = await supabase
      .from('updates')
      .insert([{ command_text: text }]);

    if (error) throw error;

    ctx.reply(`✅ Сигнал "${text}" отправлен на сайт!`);
  } catch (error) {
    console.error('Ошибка Supabase:', error);
    ctx.reply('❌ Не удалось обновить сайт. Ошибка на сервере.');
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const body = JSON.parse(event.body);
    await bot.handleUpdate(body);
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Error' };
  }
};