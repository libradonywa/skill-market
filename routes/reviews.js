const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// 获取某个技能的所有评测
router.get('/skill/:skillId', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('reviews')
      .select('*, developers(name, avatar_url)')
      .eq('skill_id', req.params.skillId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 提交评测
router.post('/', auth, async (req, res) => {
  try {
    const { skill_id, rating, comment, tags } = req.body;

    if (!skill_id || !rating) {
      return res.status(400).json({ error: 'skill_id 和 rating 为必填项' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分范围 1-5' });
    }

    // 检查技能是否存在
    const { data: skill, error: findErr } = await req.supabase
      .from('skills')
      .select('id, developer_id')
      .eq('id', skill_id)
      .single();

    if (findErr) return res.status(404).json({ error: '技能不存在' });

    // 不能给自己打分
    if (skill.developer_id === req.developerId) {
      return res.status(400).json({ error: '不能给自己的技能打分' });
    }

    // Upsert (每个开发者对一个技能只能有一个评测)
    const { data, error } = await req.supabase
      .from('reviews')
      .upsert({
        skill_id,
        developer_id: req.developerId,
        rating: parseInt(rating),
        comment: comment || '',
        tags: tags || []
      }, { onConflict: 'skill_id, developer_id' })
      .select('*, developers(name, avatar_url)')
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除评测
router.delete('/:id', auth, async (req, res) => {
  try {
    const { data: review, error: findErr } = await req.supabase
      .from('reviews')
      .select('developer_id')
      .eq('id', req.params.id)
      .single();

    if (findErr) return res.status(404).json({ error: '评测不存在' });
    if (review.developer_id !== req.developerId) {
      return res.status(403).json({ error: '无权删除此评测' });
    }

    const { error } = await req.supabase
      .from('reviews')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
