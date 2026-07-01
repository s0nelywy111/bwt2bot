const { Telegraf } = require('telegraf');
const { MediaGroup, media_group } = require('@dietime/telegraf-media-group');
const { createClient } = require('@supabase/supabase-js');

const bot = new Telegraf(process.env.BOT_TOKEN);
const COLLECTION_PREFIX = '__COLLECTION__:';
const SUPPORTED_FORMATS_MESSAGE = [
  'Можеш надсилати:',
  '• фото',
  '• відео',
  '• відео як файл-документ',
  '• колекцію / медіагрупу з кількох фото або відео',
  '',
  'До фото і відео можна додати підпис — він збережеться на сайті.',
].join('\n');

bot.use(new MediaGroup({ timeout: 1000 }).middleware());

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

function getTelegramMediaDetails(media) {
  if (media.photo) {
    const photo = media.photo[media.photo.length - 1];

    return {
      fileId: photo.file_id,
      fileName: `${Date.now()}_${photo.file_id}.jpg`,
      contentType: 'image/jpeg',
      mediaType: 'photo',
    };
  }

  if (media.video) {
    const mimeType = media.video.mime_type || 'video/mp4';

    return {
      fileId: media.video.file_id,
      fileName: `${Date.now()}_${media.video.file_id}.${getFileExtension(mimeType, 'mp4')}`,
      contentType: mimeType,
      mediaType: 'video',
    };
  }

  return null;
}

async function saveMediaRecord({ commandText, mediaUrl, mediaType }) {
  const basePayload = {
    command_text: commandText,
    image_url: mediaUrl,
  };

  const payloads = mediaType
    ? [
        {
          ...basePayload,
          media_type: mediaType,
        },
        basePayload,
      ]
    : [basePayload];

  let lastError = null;

  for (const payload of payloads) {
    const { error } = await supabase.from('updates').insert([payload]);

    if (!error) {
      return;
    }

    lastError = error;
  }

  throw lastError;
}

function isMediaGroupMessage(ctx) {
  return Boolean(ctx?.message?.media_group_id);
}

function createCollectionCommandText(collectionId, caption) {
  return `${COLLECTION_PREFIX}${collectionId}|${caption}`;
}

function createCollectionPayload({ collectionId, caption, items }) {
  return JSON.stringify({
    collectionId,
    caption,
    items,
  });
}

async function sendUploadHelp(ctx) {
  await ctx.reply(
    `Привіт, просто завантаж медіа і додай опис!\n\n${SUPPORTED_FORMATS_MESSAGE}`
  );
}

bot.start(sendUploadHelp);
bot.help(sendUploadHelp);


// НОВА МАГІЯ: Обробка фотографій
bot.on('photo', async (ctx) => {
  try {
    if (isMediaGroupMessage(ctx)) {
      return;
    }

    await ctx.reply('Отримав фото! Завантажую в хмару, зачекай кілька секунд...');
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileName = `${Date.now()}_${photo.file_id}.jpg`;
    const imageUrl = await uploadTelegramMedia(ctx, photo.file_id, fileName, 'image/jpeg');
    const caption = ctx.message.caption || 'Фото без підпису';

    await saveMediaRecord({
      commandText: caption,
      mediaUrl: imageUrl,
      mediaType: 'photo',
    });

    await ctx.reply('✅ Фотографію успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки фото:', error);
    await ctx.reply('❌ Сталася помилка під час завантаження фото.');
  }
});

bot.on(['video', 'animation'], async (ctx) => {
  try {
    if (isMediaGroupMessage(ctx)) {
      return;
    }

    const media = ctx.message.video || ctx.message.animation;
    const mimeType = media.mime_type || (ctx.message.animation ? 'video/mp4' : 'video/mp4');
    const extension = getFileExtension(mimeType, 'mp4');
    const fileName = `${Date.now()}_${media.file_id}.${extension}`;

    await ctx.reply('Отримав відео! Завантажую в хмару, зачекай кілька секунд...');

    const mediaUrl = await uploadTelegramMedia(ctx, media.file_id, fileName, mimeType);
    const caption = ctx.message.caption || 'Відео без підпису';

    await saveMediaRecord({
      commandText: caption,
      mediaUrl,
      mediaType: 'video',
    });

    await ctx.reply('✅ Відео успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки відео:', error);
    await ctx.reply('❌ Сталася помилка під час завантаження відео.');
  }
});

bot.on(media_group(), async (ctx) => {
  try {
    const group = ctx.update.media_group || [];

    if (group.length === 0) {
      return;
    }

    await ctx.reply(`Отримав колекцію з ${group.length} елементів! Завантажую в хмару, зачекай кілька секунд...`);

    const uploadedMedia = [];
    const collectionId = group[0]?.media_group_id || `collection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const caption = group.find(item => item.caption)?.caption || `Колекція з ${group.length} файлів`;

    for (const media of group) {
      const details = getTelegramMediaDetails(media);

      if (!details) {
        continue;
      }

      const mediaUrl = await uploadTelegramMedia(
        ctx,
        details.fileId,
        details.fileName,
        details.contentType
      );

      uploadedMedia.push({
        url: mediaUrl,
        type: details.mediaType,
      });
    }

    if (uploadedMedia.length === 0) {
      throw new Error('Колекція не містить підтримуваних медіа');
    }

    const coverMedia = uploadedMedia.find(item => item.type === 'photo') || uploadedMedia[0];

    await saveMediaRecord({
      commandText: createCollectionPayload({
        collectionId,
        caption,
        items: uploadedMedia,
      }),
      mediaUrl: coverMedia.url,
      mediaType: 'collection',
    });

    await ctx.reply('✅ Колекцію успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки колекції:', error);
    await ctx.reply('❌ Сталася помилка під час завантаження колекції.');
  }
});


bot.on('document', async (ctx) => {
  try {
    if (isMediaGroupMessage(ctx)) {
      return;
    }

    const document = ctx.message.document;
    if (!document.mime_type || !document.mime_type.startsWith('video/')) {
      return;
    }

    const extension = getFileExtension(document.mime_type, 'mp4');
    const fileName = `${Date.now()}_${document.file_id}.${extension}`;

    ctx.reply('Отримав відеофайл! Завантажую в хмару, зачекай кілька секунд...');

    const mediaUrl = await uploadTelegramMedia(ctx, document.file_id, fileName, document.mime_type);

    const caption = ctx.message.caption || 'Відео без підпису';

    await saveMediaRecord({
      commandText: caption,
      mediaUrl,
      mediaType: 'video',
    });

    await ctx.reply('✅ Відеофайл успішно завантажено на сайт!');
  } catch (error) {
    console.error('Помилка обробки відеофайлу:', error);
    await ctx.reply('❌ Сталася помилка під час завантаження відеофайлу.');
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