const SUPABASE_URL = "https://qqfcxkgxtcgwjfjphlmh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZmN4a2d4dGNnd2pmanBobG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIyODMsImV4cCI6MjA5Nzk1ODI4M30.mqub59FJ47UUEdu85y32PnE_GUTwSlPnPMQIe0BdY14";

const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById('status');
const logList = document.getElementById('log');
const gallery = document.getElementById('gallery');
const photoModal = document.getElementById('photo-modal');
const photoModalImage = document.getElementById('photo-modal-image');
const photoModalCaption = document.getElementById('photo-modal-caption');
const photoModalClose = document.getElementById('photo-modal-close');
const visiblePhotoCount = 3;
const rotationIntervalMs = 12000;

let photoPool = [];
let visiblePhotos = [];
let rotationTimerId = null;

function pickRandomItems(items, count) {
  const pool = [...items];
  const selected = [];

  while (pool.length > 0 && selected.length < count) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(randomIndex, 1)[0]);
  }

  return selected;
}

function renderGallery() {
  if (!gallery) {
    return;
  }

  gallery.innerHTML = '';

  visiblePhotos.forEach(item => {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.dataset.photoId = item.id;
    card.innerHTML = `
      <img class="photo-card__image" src="${item.image_url}" alt="${item.command_text || 'Фото'}">
      <div class="photo-card__overlay">
        <p class="photo-card__caption">${item.command_text || 'Без подписи'}</p>
      </div>
    `;
    gallery.appendChild(card);
  });
}

function syncVisiblePhotos(nextPhotos) {
  visiblePhotos = nextPhotos.slice(0, visiblePhotoCount);
  renderGallery();
}

function rotateVisiblePhoto() {
  if (photoPool.length <= visiblePhotoCount) {
    return;
  }

  const visibleIds = new Set(visiblePhotos.map(photo => photo.id));
  const candidates = photoPool.filter(photo => !visibleIds.has(photo.id));

  if (candidates.length === 0) {
    return;
  }

  const photoToInsert = candidates[Math.floor(Math.random() * candidates.length)];
  const replaceIndex = Math.floor(Math.random() * visiblePhotos.length);
  const nextVisiblePhotos = [...visiblePhotos];

  nextVisiblePhotos[replaceIndex] = photoToInsert;
  syncVisiblePhotos(nextVisiblePhotos);
}

function startRotation() {
  if (rotationTimerId) {
    clearInterval(rotationTimerId);
  }

  rotationTimerId = setInterval(rotateVisiblePhoto, rotationIntervalMs);
}

function openPhotoModal(photo) {
  if (!photoModal || !photoModalImage || !photoModalCaption || !photo) {
    return;
  }

  photoModalImage.src = photo.image_url;
  photoModalImage.alt = photo.command_text || 'Фото';
  photoModalCaption.textContent = photo.command_text || 'Без подписи';
  photoModal.classList.add('is-open');
  photoModal.setAttribute('aria-hidden', 'false');
}

function closePhotoModal() {
  if (!photoModal || !photoModalImage || !photoModalCaption) {
    return;
  }

  photoModal.classList.remove('is-open');
  photoModal.setAttribute('aria-hidden', 'true');
  photoModalImage.src = '';
  photoModalImage.alt = '';
  photoModalCaption.textContent = '';
}

if (gallery) {
  gallery.addEventListener('click', event => {
    const card = event.target.closest('.photo-card');

    if (!card) {
      return;
    }

    const photo = visiblePhotos.find(item => String(item.id) === card.dataset.photoId);

    if (photo) {
      openPhotoModal(photo);
    }
  });

  gallery.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const card = event.target.closest('.photo-card');

    if (!card) {
      return;
    }

    event.preventDefault();

    const photo = visiblePhotos.find(item => String(item.id) === card.dataset.photoId);

    if (photo) {
      openPhotoModal(photo);
    }
  });
}

if (photoModal) {
  photoModal.addEventListener('click', event => {
    if (event.target === photoModal) {
      closePhotoModal();
    }
  });
}

if (photoModalClose) {
  photoModalClose.addEventListener('click', closePhotoModal);
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closePhotoModal();
  }
});

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

  photoPool = data.filter(item => Boolean(item.image_url));
  syncVisiblePhotos(pickRandomItems(photoPool, visiblePhotoCount));
  startRotation();
}

// Запускаем функцию загрузки фото сразу при открытии сайта
loadRandomPhotos();

// Подписываемся на обновления в реальном времени (как было)
dbClient
  .channel('public:updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, payload => {
    const newData = payload.new;
    if (statusDiv) {
      statusDiv.innerText = `Получено обновление: "${newData.command_text}"`;
    }
    
    // Если прилетела картинка, добавляем ее в общий пул и мягко показываем в галерее.
    if (newData.image_url) {
      photoPool.unshift(newData);

      if (visiblePhotos.length < visiblePhotoCount) {
        syncVisiblePhotos(pickRandomItems(photoPool, visiblePhotoCount));
      } else {
        const replaceIndex = Math.floor(Math.random() * visiblePhotos.length);
        const nextVisiblePhotos = [...visiblePhotos];
        nextVisiblePhotos[replaceIndex] = newData;
        syncVisiblePhotos(nextVisiblePhotos);
      }
    } else {
      if (logList) {
        const li = document.createElement('li');
        li.innerText = `[${new Date().toLocaleTimeString()}] ${newData.command_text}`;
        logList.prepend(li);
      }
    }
  })
  .subscribe();