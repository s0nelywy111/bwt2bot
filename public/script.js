const SUPABASE_URL = "sb_publishable_MMIUihZ4jbZV23JIen_-tg_aq7uY3NS";
const SUPABASE_KEY = "sb_secret_WsaFF-6oSSxT6O-hz2tdeQ_DKS9l2AS";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById('status');
const logList = document.getElementById('log');

// Подписываемся на изменения в таблице updates в реальном времени
supabase
  .channel('public:updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, payload => {
    const newCommand = payload.new.command_text;
    
    // Меняем текст на сайте мгновенно!
    statusDiv.innerText = `Получено: "${newCommand}"`;
    
    // Добавляем запись в историю под текстом
    const li = document.createElement('li');
    li.innerText = `[${new Date().toLocaleTimeString()}] ${newCommand}`;
    logList.prepend(li);
  })
  .subscribe();