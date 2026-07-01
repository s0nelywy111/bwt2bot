const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
// ВИКОРИСТОВУЄМО СЕКРЕТНИЙ КЛЮЧ ДЛЯ БЕКЕНДУ (щоб обходити обмеження запису)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function getFileExtension(mimeType, fallbackExtension = 'bin') {
  const normalizedMimeType = (mimeType || '').toLowerCase();

  if (normalizedMimeType === 'image/jpeg') return 'jpg';
  if (normalizedMimeType === 'image/png') return 'png';
  if (normalizedMimeType === 'image/webp') return 'webp';
  if (normalizedMimeType === 'video/mp4') return 'mp4';
  if (normalizedMimeType === 'video/webm') return 'webm';
  if (normalizedMimeType === 'video/quicktime') return 'mov';
  if (normalizedMimeType === 'video/x-matroska') return 'mkv';

  return fallbackExtension;
}

async function uploadTelegramMedia(ctx, fileId, fileName, contentType) {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, arrayBuffer, { contentType });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from('photos').getPublicUrl(fileName);
  return publicData.publicUrl;
}

bot.start((ctx) => ctx.reply('Привіт, просто завантаж фото і додай опис!'));

// Стара обробка тексту
bot.command('update', async (ctx) => {
  try {
    const text = ctx.message.text.replace('/update', '').trim() || 'Кнопка натиснута!';
    const { error } = await supabase.from('updates').insert([{ command_text: text }]);
    if (error) throw error;
    ctx.reply(`✅ Сигнал "${text}" надіслано!`);
  } catch (error) {
    ctx.reply('❌ Помилка бази даних.');
  }
});

// НОВА МАГІЯ: Обробка фотографій
bot.on('photo', async (ctx) => {
  try {
    ctx.reply('Отримав фото! Завантажую в хмару, зачекай кілька секунд...');

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileName = `${Date.now()}_${photo.file_id}.jpg`;
    const imageUrl = await uploadTelegramMedia(ctx, photo.file_id, fileName, 'image/jpeg');
    const caption = ctx.message.caption || 'Фото без підпису';
    const { error: dbError } = await supabase.from('updates').insert([{ 
      command_text: caption, 
      image_url: imageUrl 
    }]);

    if (dbError) throw dbError;
    ctx.reply('✅ Фотографію успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки фото:', error);
    ctx.reply('❌ Сталася помилка під час завантаження фото.');
  }
});

bot.on(['video', 'animation'], async (ctx) => {
  try {
    const media = ctx.message.video || ctx.message.animation;
    const mimeType = media.mime_type || (ctx.message.animation ? 'video/mp4' : 'video/mp4');
    const extension = getFileExtension(mimeType, 'mp4');
    const fileName = `${Date.now()}_${media.file_id}.${extension}`;

    ctx.reply('Отримав відео! Завантажую в хмару, зачекай кілька секунд...');

    const mediaUrl = await uploadTelegramMedia(ctx, media.file_id, fileName, mimeType);
    const caption = ctx.message.caption || 'Відео без підпису';

    const { error: dbError } = await supabase.from('updates').insert([{ 
      command_text: caption,
      image_url: mediaUrl 
    }]);

    if (dbError) throw dbError;
    ctx.reply('✅ Відео успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки відео:', error);
    ctx.reply('❌ Сталася помилка під час завантаження відео.');
  }
});

bot.on('document', async (ctx) => {
  try {
    const document = ctx.message.document;
    if (!document.mime_type || !document.mime_type.startsWith('video/')) {
      return;
    }

    const extension = getFileExtension(document.mime_type, 'mp4');
    const fileName = `${Date.now()}_${document.file_id}.${extension}`;

    ctx.reply('Отримав відеофайл! Завантажую в хмару, зачекай кілька секунд...');

    const mediaUrl = await uploadTelegramMedia(ctx, document.file_id, fileName, document.mime_type);

    const caption = ctx.message.caption || 'Відео без підпису';

    const { error: dbError } = await supabase.from('updates').insert([{ 
      command_text: caption,
      image_url: mediaUrl 
    }]);

    if (dbError) throw dbError;
    ctx.reply('✅ Відеофайл успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки відеофайлу:', error);
    ctx.reply('❌ Сталася помилка під час завантаження відеофайлу.');
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Метод не дозволений' };
  try {
    await bot.handleUpdate(JSON.parse(event.body));
    return { statusCode: 200, body: 'Гаразд' };
  } catch (error) {
    return { statusCode: 500, body: 'Помилка' };
  }
};