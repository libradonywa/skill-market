// 只在本地开发时加载 .env，Render 上直接用环境变量
try {
  require('dotenv').config();
} catch (e) {
  // dotenv 不存在时忽略（生产环境用 Render env vars）
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 将 supabase 注入 req
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// 测试路由
app.get('/ping', (req, res) => {
  res.json({ pong: true, env: !!process.env.SUPABASE_URL });
});

// 路由 (包裹 try-catch 防止 require 崩溃)
try { app.use('/api/skills', require('./routes/skills')); } catch(e) { console.error('skills route failed:', e.message); }
try { app.use('/api/reviews', require('./routes/reviews')); } catch(e) { console.error('reviews route failed:', e.message); }
try { app.use('/api/developers', require('./routes/developers')); } catch(e) { console.error('developers route failed:', e.message); }
try { app.use('/api/stats', require('./routes/stats')); } catch(e) { console.error('stats route failed:', e.message); }

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - 放在所有 API 路由之后
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SkillHub 运行在 http://localhost:${PORT}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'configured' : 'MISSING'}`);
  console.log(`Supabase Key: ${process.env.SUPABASE_ANON_KEY ? 'configured' : 'MISSING'}`);
  console.log(`PORT env: ${process.env.PORT}`);
  console.log(`Routes: /api/health, /api/skills, /api/reviews, /api/developers, /api/stats`);
});

module.exports = app;
