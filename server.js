require('dotenv').config();
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

// 路由
app.use('/api/skills', require('./routes/skills'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/developers', require('./routes/developers'));
app.use('/api/stats', require('./routes/stats'));

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
