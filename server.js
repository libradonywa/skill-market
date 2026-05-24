const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// 尝试加载 .env
try { require('dotenv').config(); } catch (e) { /* dotenv not found */ }

const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== SkillHub Starting ===');
console.log('PORT env:', process.env.PORT);
console.log('PORT used:', PORT);
console.log('SUPABASE_URL set:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY set:', !!process.env.SUPABASE_ANON_KEY);

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn('WARNING: Supabase not configured! API routes will fail.');
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 注入 Supabase 到 request
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// 健康检查 (放在 static 之前)
app.get('/ping', (req, res) => {
  res.json({ pong: true, supabase: !!supabase });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', supabase: !!supabase, timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/skills', require('./routes/skills'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/developers', require('./routes/developers'));
app.use('/api/stats', require('./routes/stats'));

// 静态文件 (SPA)
app.use(express.static('public'));

// SPA fallback: 所有非 API 请求返回 index.html
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found', path: req.path });
  }
  res.sendFile('index.html', { root: './public' });
});

app.listen(PORT, () => {
  console.log(`SkillHub running on port ${PORT}`);
});
