const SUPABASE_URL = "https://qqfcxkgxtcgwjfjphlmh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZmN4a2d4dGNnd2pmanBobG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIyODMsImV4cCI6MjA5Nzk1ODI4M30.mqub59FJ47UUEdu85y32PnE_GUTwSlPnPMQIe0BdY14";

const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById('status');
const logList = document.getElementById('log');
const gallery = document.getElementById('gallery');

// ФУНКЦИЯ ЗАГРУЗКИ СЛУЧАЙНЫХ ФОТО ПРИ СТАРТЕ
async function loadRandomPhotos() {
  // Запрашиваем из базы все записи, где image_url НЕ пустой
  const { data, error } = await dbClient
    .from('updates')
    .select('*')
    .not('image_url', 'is', null);

  if (error) {
    console.error('Ошибка загрузки фото:', error);
    gallery.innerHTML = '<p style="color:red;">Не удалось загрузить галерею</p>';
    return;
  }

  if (data.length === 0) {
    gallery.innerHTML = '<p>Пока нет загруженных фотографий.</p>';
    return;
  }

  // Магия JavaScript: Перемешиваем массив случайным образом
  const shuffled = data.sort(() => 0.5 - Math.random());
  
  // Берем первые 3 фотографии (можешь изменить число)
  const selectedPhotos = shuffled.slice(0, 3);

  // Очищаем текст "Загружаю..."
  gallery.innerHTML = '';

  // Рисуем картинки на странице
  selectedPhotos.forEach(item => {
    const imgContainer = document.createElement('div');
    imgContainer.innerHTML = `
      <img src="${item.image_url}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 12px; color: gray;">${item.command_text}</p>
    `;
    gallery.appendChild(imgContainer);
  });
}

// Запускаем функцию загрузки фото сразу при открытии сайта
loadRandomPhotos();

// Подписываемся на обновления в реальном времени (как было)
dbClient
  .channel('public:updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, payload => {
    const newData = payload.new;
    statusDiv.innerText = `Получено обновление: "${newData.command_text}"`;
    
    // Если прилетела картинка, добавляем ее в начало галереи наживую!
    if (newData.image_url) {
      const imgContainer = document.createElement('div');
      imgContainer.innerHTML = `
        <img src="${newData.image_url}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 10px; border: 3px solid #4CAF50;">
        <p style="font-size: 12px; color: gray;">Новое: ${newData.command_text}</p>
      `;
      gallery.prepend(imgContainer);
    } else {
      const li = document.createElement('li');
      li.innerText = `[${new Date().toLocaleTimeString()}] ${newData.command_text}`;
      logList.prepend(li);
    }
  })
  .subscribe();