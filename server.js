const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 全局错误捕获
process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err.message, err.stack));
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION:', reason));

// 尝试加载 .env (本地开发)
try { require('dotenv').config(); } catch (e) {}

console.log('=== SkillHub v2 — Starting ===');
console.log('PORT:', PORT);
console.log('Node:', process.version);
console.log('CWD:', process.cwd());
console.log('SUPABASE_URL:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', !!process.env.SUPABASE_ANON_KEY);

// Supabase (延迟初始化，不阻塞启动)
let supabase = null;
function getSupabase() {
  if (supabase) return supabase;
  try {
    const { createClient } = require('@supabase/supabase-js');
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      console.log('Supabase connected');
    }
  } catch (e) {
    console.error('Supabase init failed:', e.message);
  }
  return supabase;
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 注入 Supabase
app.use((req, res, next) => {
  req.supabase = getSupabase();
  next();
});

// ====== 健康检查 ======
app.get('/ping', (req, res) => {
  res.json({ pong: true, node: process.version, uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    node: process.version,
    supabase: !!req.supabase,
    timestamp: new Date().toISOString()
  });
});

// ====== API 路由 ======
try {
  app.use('/api/skills', require('./routes/skills'));
  console.log('Route /api/skills mounted');
} catch (e) { console.error('FAIL skills route:', e.message); }

try {
  app.use('/api/reviews', require('./routes/reviews'));
  console.log('Route /api/reviews mounted');
} catch (e) { console.error('FAIL reviews route:', e.message); }

try {
  app.use('/api/developers', require('./routes/developers'));
  console.log('Route /api/developers mounted');
} catch (e) { console.error('FAIL developers route:', e.message); }

try {
  app.use('/api/stats', require('./routes/stats'));
  console.log('Route /api/stats mounted');
} catch (e) { console.error('FAIL stats route:', e.message); }

// ====== 静态文件 ======
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Unknown API route' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`SkillHub listening on 0.0.0.0:${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});
