const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting SkillHub...');
console.log('PORT env:', process.env.PORT);
console.log('SUPABASE_URL set:', !!process.env.SUPABASE_URL);

app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`SkillHub running on port ${PORT}`);
});
