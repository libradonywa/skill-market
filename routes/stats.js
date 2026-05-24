const express = require('express');
const router = express.Router();

// 平台统计
router.get('/', async (req, res) => {
  try {
    const [skillsResult, devsResult, reviewsResult, downloadsResult] = await Promise.all([
      req.supabase.from('skills').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      req.supabase.from('developers').select('id', { count: 'exact', head: true }),
      req.supabase.from('reviews').select('id', { count: 'exact', head: true }),
      req.supabase.from('downloads').select('id', { count: 'exact', head: true })
    ]);

    res.json({
      skills_count: skillsResult.count || 0,
      developers_count: devsResult.count || 0,
      reviews_count: reviewsResult.count || 0,
      downloads_count: downloadsResult.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 分类统计
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('skills')
      .select('category')
      .eq('status', 'active');

    if (error) throw error;

    const counts = {};
    data.forEach(s => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });

    res.json(Object.entries(counts).map(([name, count]) => ({ name, count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
