const SUPABASE_URL = "ТВОЙ_PROJECT_URL";
const SUPABASE_KEY = "ТВОЙ_ANON_PUBLIC_KEY";

// ИСПРАВЛЕНО: Назвали переменную dbClient вместо supabase
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const statusDiv = document.getElementById('status');
const logList = document.getElementById('log');

// Подписываемся на изменения
dbClient
  .channel('public:updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'updates' }, payload => {
    const newCommand = payload.new.command_text;
    
    // Меняем текст на сайте мгновенно
    statusDiv.innerText = `Получено: "${newCommand}"`;
    
    // Добавляем запись в историю
    const li = document.createElement('li');
    li.innerText = `[${new Date().toLocaleTimeString()}] ${newCommand}`;
    logList.prepend(li);
  })
  .subscribe();