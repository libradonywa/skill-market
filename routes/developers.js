const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// 获取开发者公开信息
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('developers')
      .select('id, name, bio, avatar_url, skills_count, total_downloads, joined_at')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: '开发者不存在' });
      throw error;
    }

    // 同时获取该开发者的技能列表
    const { data: skills } = await req.supabase
      .from('skills')
      .select('id, name, description, version, category, download_count, rating_avg, rating_count, created_at')
      .eq('developer_id', req.params.id)
      .eq('status', 'published')
      .order('download_count', { ascending: false });

    res.json({ ...data, skills: skills || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取当前登录开发者的完整信息
router.get('/me/profile', auth, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('developers')
      .select('*')
      .eq('id', req.developerId)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新个人信息
router.put('/me/profile', auth, async (req, res) => {
  try {
    const { name, bio, avatar_url } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: '无更新内容' });
    }

    const { data, error } = await req.supabase
      .from('developers')
      .update(updateData)
      .eq('id', req.developerId)
      .select('*')
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取开发者排行
router.get('/top/list', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data, error } = await req.supabase
      .from('developers')
      .select('id, name, avatar_url, skills_count, total_downloads')
      .order('total_downloads', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
