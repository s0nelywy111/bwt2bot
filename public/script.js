const SUPABASE_URL = "https://qqfcxkgxtcgwjfjphlmh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZmN4a2d4dGNnd2pmanBobG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIyODMsImV4cCI6MjA5Nzk1ODI4M30.mqub59FJ47UUEdu85y32PnE_GUTwSlPnPMQIe0BdY14";

const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById('status');
const logList = document.getElementById('log');
const openGalleryButton = document.getElementById('open-gallery-btn');
const featuredPreview = document.getElementById('featured-preview');
const featuredTrack = document.getElementById('featured-track');
const galleryPanel = document.getElementById('gallery-panel');
const photoTrack = document.getElementById('photo-track');
const videoTrack = document.getElementById('video-track');
const collectionTrack = document.getElementById('collection-track');
const galleryTabs = Array.from(document.querySelectorAll('[data-gallery-tab]'));
const gallerySections = Array.from(document.querySelectorAll('[data-gallery-section]'));
const photoModal = document.getElementById('photo-modal');
const photoModalImage = document.getElementById('photo-modal-image');
const photoModalVideo = document.getElementById('photo-modal-video');
const photoModalCaption = document.getElementById('photo-modal-caption');
const photoModalClose = document.getElementById('photo-modal-close');

let photoPool = [];
let videoPool = [];
let collectionPool = [];
let featuredPhotos = [];
let activeGalleryTab = 'photos';
let featuredRotationTimerId = null;
const featuredPhotoCount = 3;
const featuredRotationIntervalMs = 2800;
const COLLECTION_PREFIX = '__COLLECTION__:';

function getMediaUrl(item) {
  return item.media_url || item.image_url || item.video_url || '';
}

function isVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url || '');
}

function parseCollectionMetadata(rawCaption) {
  if (!rawCaption.startsWith(COLLECTION_PREFIX)) {
    return {
      isCollectionMember: false,
      collectionKey: null,
      collectionTitle: null,
    };
  }

  const encoded = rawCaption.slice(COLLECTION_PREFIX.length);
  const separatorIndex = encoded.indexOf('|');

  if (separatorIndex === -1) {
    return {
      isCollectionMember: true,
      collectionKey: encoded || null,
      collectionTitle: encoded || '',
    };
  }

  return {
    isCollectionMember: true,
    collectionKey: encoded.slice(0, separatorIndex) || null,
    collectionTitle: encoded.slice(separatorIndex + 1) || '',
  };
}

function normalizeMediaItem(item) {
  const src = getMediaUrl(item);

  if (!src) {
    return null;
  }

  const rawCaption = item.command_text || '';
  const collectionMetadata = parseCollectionMetadata(rawCaption);
  const type = item.media_type || (isVideoUrl(src) ? 'video' : 'photo');
  const captionFallbacks = {
    video: 'Відео без підпису',
    photo: 'Фото без підпису',
  };

  return {
    id: String(item.id || `${type}-${src}`),
    type,
    src,
    caption: collectionMetadata.collectionTitle || rawCaption || captionFallbacks[type] || 'Медіа без підпису',
    collectionKey: collectionMetadata.collectionKey,
    isCollectionMember: collectionMetadata.isCollectionMember,
  };
}

function getRenderableMediaType(media) {
  if (media.type === 'collection' && media.items && media.items.length > 0) {
    return getRenderableMediaType(media.items[0]);
  }

  if (media.type === 'collection' && isVideoUrl(media.src)) {
    return 'video';
  }

  return media.type;
}

function createPreviewThumb(media, orderIndex) {
  const thumb = document.createElement('div');
  thumb.className = `collection-stack__item collection-stack__item--${orderIndex + 1}`;

  if (isVideoUrl(media.src)) {
    const video = document.createElement('video');
    video.className = 'collection-stack__media';
    video.src = media.src;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    thumb.appendChild(video);
  } else {
    const image = document.createElement('img');
    image.className = 'collection-stack__media';
    image.src = media.src;
    image.alt = media.caption;
    thumb.appendChild(image);
  }

  return thumb;
}

function createCollectionCard(collection) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'media-card media-card--collection';
  card.dataset.mediaId = collection.id;
  card.dataset.mediaType = collection.type;

  const frame = document.createElement('div');
  frame.className = 'media-card__frame media-card__frame--collection';

  const stack = document.createElement('div');
  stack.className = 'collection-stack';

  collection.items.slice(0, 3).forEach((item, index) => {
    stack.appendChild(createPreviewThumb(item, index));
  });

  if (collection.items.length > 3) {
    const extraCount = document.createElement('div');
    extraCount.className = 'collection-stack__more';
    extraCount.textContent = `+${collection.items.length - 3}`;
    stack.appendChild(extraCount);
  }

  const countBadge = document.createElement('div');
  countBadge.className = 'collection-stack__count';
  countBadge.textContent = `${collection.items.length} медіа`;

  frame.appendChild(stack);
  frame.appendChild(countBadge);

  const overlay = document.createElement('div');
  overlay.className = 'media-card__overlay';

  const tag = document.createElement('span');
  tag.className = 'media-card__tag';
  tag.textContent = 'Колекція';

  const caption = document.createElement('p');
  caption.className = 'media-card__caption';
  caption.textContent = collection.caption;

  overlay.appendChild(tag);
  overlay.appendChild(caption);

  card.appendChild(frame);
  card.appendChild(overlay);

  return card;
}

function buildGalleryPools(items) {
  const photos = [];
  const videos = [];
  const collectionMap = new Map();

  items.forEach(item => {
    if (item.isCollectionMember && item.collectionKey) {
      const collectionId = String(item.collectionKey);

      if (!collectionMap.has(collectionId)) {
        collectionMap.set(collectionId, {
          id: `collection-${collectionId}`,
          type: 'collection',
          caption: item.caption || 'Колекція без підпису',
          items: [],
        });
      }

      collectionMap.get(collectionId).items.push(item);
      return;
    }

    if (item.type === 'video') {
      videos.push(item);
    } else {
      photos.push(item);
    }
  });

  const collections = Array.from(collectionMap.values())
    .filter(collection => collection.items.length > 0)
    .map(collection => ({
      ...collection,
      src: collection.items[0].src,
      cover: collection.items[0],
      count: collection.items.length,
    }));

  return { photos, videos, collections };
}

function createMediaCard(media) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'media-card';
  card.dataset.mediaId = media.id;
  card.dataset.mediaType = media.type;
  const renderType = getRenderableMediaType(media);

  const frame = document.createElement('div');
  frame.className = 'media-card__frame';

  if (renderType === 'video') {
    const video = document.createElement('video');
    video.className = 'media-card__video';
    video.src = media.src;
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    frame.appendChild(video);

    const playBadge = document.createElement('span');
    playBadge.className = 'media-card__play';
    playBadge.textContent = '▶';
    frame.appendChild(playBadge);
  } else {
    const image = document.createElement('img');
    image.className = 'media-card__image';
    image.src = media.src;
    image.alt = media.caption;
    frame.appendChild(image);
  }

  const overlay = document.createElement('div');
  overlay.className = 'media-card__overlay';

  const tag = document.createElement('span');
  tag.className = 'media-card__tag';
  tag.textContent = media.type === 'collection' ? 'Колекція' : media.type === 'video' ? 'Відео' : 'Фото';

  const caption = document.createElement('p');
  caption.className = 'media-card__caption';
  caption.textContent = media.caption;

  overlay.appendChild(tag);
  overlay.appendChild(caption);
  card.appendChild(frame);
  card.appendChild(overlay);

  return card;
}

function renderMediaTrack(trackElement, items, emptyText) {
  if (!trackElement) {
    return;
  }

  trackElement.innerHTML = '';

  if (items.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = emptyText;
    trackElement.appendChild(emptyState);
    return;
  }

  items.forEach(item => {
    trackElement.appendChild(item.type === 'collection' ? createCollectionCard(item) : createMediaCard(item));
  });
}

function renderFeaturedPreview() {
  if (!featuredTrack) {
    return;
  }

  featuredTrack.innerHTML = '';

  if (featuredPhotos.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Тут поки немає фото.';
    featuredTrack.appendChild(emptyState);
    return;
  }

  featuredPhotos.forEach(item => {
    featuredTrack.appendChild(createMediaCard(item));
  });
}

function pickRandomItems(items, count) {
  const pool = [...items];
  const selected = [];

  while (pool.length > 0 && selected.length < count) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(randomIndex, 1)[0]);
  }

  return selected;
}

function syncFeaturedPhotos(nextPhotos) {
  featuredPhotos = nextPhotos.slice(0, featuredPhotoCount);
  renderFeaturedPreview();
}

function rotateFeaturedPhoto() {
  if (photoPool.length <= featuredPhotoCount || featuredPhotos.length === 0) {
    return;
  }

  const visibleIds = new Set(featuredPhotos.map(photo => photo.id));
  const candidates = photoPool.filter(photo => !visibleIds.has(photo.id));

  if (candidates.length === 0) {
    return;
  }

  const photoToInsert = candidates[Math.floor(Math.random() * candidates.length)];
  const replaceIndex = Math.floor(Math.random() * featuredPhotos.length);
  const nextFeaturedPhotos = [...featuredPhotos];

  nextFeaturedPhotos[replaceIndex] = photoToInsert;
  syncFeaturedPhotos(nextFeaturedPhotos);
}

function startFeaturedRotation() {
  stopFeaturedRotation();
  featuredRotationTimerId = setInterval(rotateFeaturedPhoto, featuredRotationIntervalMs);
}

function stopFeaturedRotation() {
  if (featuredRotationTimerId) {
    clearInterval(featuredRotationTimerId);
    featuredRotationTimerId = null;
  }
}

function renderGallery() {
  renderMediaTrack(photoTrack, photoPool, 'Тут поки немає фото.');
  renderMediaTrack(videoTrack, videoPool, 'Тут поки немає відео.');
  renderMediaTrack(collectionTrack, collectionPool, 'Тут поки немає колекцій.');
}

function setGalleryOpen(isOpen) {
  if (!galleryPanel || !openGalleryButton || !featuredPreview) {
    return;
  }

  galleryPanel.classList.toggle('is-open', isOpen);
  galleryPanel.setAttribute('aria-hidden', String(!isOpen));
  openGalleryButton.textContent = isOpen ? 'Сховати галерею' : 'Відкрити галерею';
  featuredPreview.classList.toggle('is-hidden', isOpen);

  if (isOpen) {
    galleryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    stopFeaturedRotation();
  } else {
    renderFeaturedPreview();
    startFeaturedRotation();
  }
}

function setActiveTab(tabName) {
  activeGalleryTab = tabName;

  galleryTabs.forEach(button => {
    button.classList.toggle('is-active', button.dataset.galleryTab === tabName);
  });

  gallerySections.forEach(section => {
    section.classList.toggle('is-active', section.dataset.gallerySection === tabName);
  });
}

function findMediaById(mediaId, mediaType) {
  let pools = photoPool;

  if (mediaType === 'video') {
    pools = videoPool;
  } else if (mediaType === 'collection') {
    pools = collectionPool;
  }

  return pools.find(item => item.id === mediaId);
}

function openMediaModal(media) {
  if (!photoModal || !photoModalImage || !photoModalVideo || !photoModalCaption || !media) {
    return;
  }

  const mediaTarget = media.type === 'collection' && media.items && media.items.length > 0 ? media.items[0] : media;
  const renderType = getRenderableMediaType(mediaTarget);

  photoModalImage.hidden = renderType !== 'photo';
  photoModalVideo.hidden = renderType !== 'video';

  if (renderType === 'video') {
    photoModalVideo.src = mediaTarget.src;
    photoModalVideo.currentTime = 0;
    photoModalVideo.play().catch(() => {});
  } else {
    photoModalImage.src = mediaTarget.src;
    photoModalImage.alt = media.caption;
  }

  photoModalCaption.textContent = media.caption;
  photoModal.classList.add('is-open');
  photoModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closePhotoModal() {
  if (!photoModal || !photoModalImage || !photoModalVideo || !photoModalCaption) {
    return;
  }

  photoModal.classList.remove('is-open');
  photoModal.setAttribute('aria-hidden', 'true');
  photoModalImage.src = '';
  photoModalImage.alt = '';
  photoModalVideo.pause();
  photoModalVideo.removeAttribute('src');
  photoModalVideo.load();
  photoModalCaption.textContent = '';
  document.body.classList.remove('modal-open');
}

if (openGalleryButton) {
  openGalleryButton.addEventListener('click', () => {
    const isOpen = !galleryPanel || !galleryPanel.classList.contains('is-open');
    setGalleryOpen(isOpen);
  });
}

galleryTabs.forEach(button => {
  button.addEventListener('click', () => setActiveTab(button.dataset.galleryTab));
});

if (photoTrack) {
  photoTrack.addEventListener('click', event => {
    const card = event.target.closest('.media-card');

    if (!card) {
      return;
    }

    const media = findMediaById(card.dataset.mediaId, card.dataset.mediaType);

    if (media) {
      openMediaModal(media);
    }
  });
}

if (videoTrack) {
  videoTrack.addEventListener('click', event => {
    const card = event.target.closest('.media-card');

    if (!card) {
      return;
    }

    const media = findMediaById(card.dataset.mediaId, card.dataset.mediaType);

    if (media) {
      openMediaModal(media);
    }
  });
}

if (collectionTrack) {
  collectionTrack.addEventListener('click', event => {
    const card = event.target.closest('.media-card');

    if (!card) {
      return;
    }

    const media = findMediaById(card.dataset.mediaId, card.dataset.mediaType);

    if (media) {
      openMediaModal(media);
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

async function loadGalleryMedia() {
  const { data, error } = await dbClient
    .from('updates')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('Помилка при спробі відкрити галерею:', error);
    if (photoTrack) {
      photoTrack.innerHTML = '<p class="empty-state empty-state--error">Помилка. Не вдалось відкрити галерею</p>';
    }
    return;
  }

  const mediaItems = data.map(normalizeMediaItem).filter(Boolean);
  const groupedPools = buildGalleryPools(mediaItems);
  photoPool = groupedPools.photos;
  videoPool = groupedPools.videos;
  collectionPool = groupedPools.collections;
  syncFeaturedPhotos(pickRandomItems(photoPool, featuredPhotoCount));

  renderGallery();
}

loadGalleryMedia();
startFeaturedRotation();

dbClient
  .channel('public:updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, payload => {
    const newData = payload.new;
    if (statusDiv) {
      statusDiv.innerText = `Отримано оновлення: "${newData.command_text}"`;
    }

    if (logList) {
      const li = document.createElement('li');
      li.innerText = `[${new Date().toLocaleTimeString()}] ${newData.command_text}`;
      logList.prepend(li);
    }

    loadGalleryMedia();
  })
  .subscribe();