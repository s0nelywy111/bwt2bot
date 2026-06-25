const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
// ИСПОЛЬЗУЕМ СЕКРЕТНЫЙ КЛЮЧ ДЛЯ БЭКЕНДА (чтобы обходить ограничения записи)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

bot.start((ctx) => ctx.reply('Привет! Отправь мне команду /update или просто скинь фотографию!'));

// Старая обработка текста
bot.command('update', async (ctx) => {
  try {
    const text = ctx.message.text.replace('/update', '').trim() || 'Кнопка нажата!';
    const { error } = await supabase.from('updates').insert([{ command_text: text }]);
    if (error) throw error;
    ctx.reply(`✅ Сигнал "${text}" отправлен!`);
  } catch (error) {
    ctx.reply('❌ Ошибка базы данных.');
  }
});

// НОВАЯ МАГИЯ: Обработка фотографий
bot.on('photo', async (ctx) => {
  try {
    ctx.reply('Получил фото! Загружаю в облако, подожди пару секунд...');

    // 1. Берем фото в самом высоком качестве (оно всегда последнее в массиве)
    const photo = ctx.message.photo.pop();
    
    // 2. Получаем временную ссылку от Telegram
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    
    // 3. Скачиваем фото в память Netlify
    const response = await fetch(fileLink.href);
    const arrayBuffer = await response.arrayBuffer();

    // 4. Генерируем уникальное имя файла
    const fileName = `${Date.now()}_${photo.file_id}.jpg`;

    // 5. Загружаем в Supabase Storage (в корзину photos)
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    // 6. Получаем вечную публичную ссылку на фото
    const { data: publicData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const imageUrl = publicData.publicUrl;

    // 7. Сохраняем ссылку и подпись в нашу таблицу updates
    const caption = ctx.message.caption || 'Фото без подписи';
    const { error: dbError } = await supabase.from('updates').insert([{ 
      command_text: caption, 
      image_url: imageUrl 
    }]);

    if (dbError) throw dbError;

    ctx.reply('✅ Фотография успешно загружена на сайт!');
  } catch (error) {
    console.error('Ошибка обработки фото:', error);
    ctx.reply('❌ Произошла ошибка при загрузке фото.');
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    await bot.handleUpdate(JSON.parse(event.body));
    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    return { statusCode: 500, body: 'Error' };
  }
};