const SUPABASE_URL = "https://qqfcxkgxtcgwjfjphlmh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZmN4a2d4dGNnd2pmanBobG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODIyODMsImV4cCI6MjA5Nzk1ODI4M30.mqub59FJ47UUEdu85y32PnE_GUTwSlPnPMQIe0BdY14";

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