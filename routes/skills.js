const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

// 文件上传配置 (内存存储，之后上传到 Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.zip', '.json', '.md', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  }
});

// ==================== 公开 API ====================

// 获取技能列表 (支持搜索、分类、排序)
router.get('/', async (req, res) => {
  try {
    const { search, category, sort = 'latest', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = req.supabase
      .from('skills')
      .select('*, developers(name, avatar_url)', { count: 'exact' })
      .eq('status', 'active');

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    switch (sort) {
      case 'downloads': query = query.order('download_count', { ascending: false }); break;
      case 'rating': query = query.order('avg_rating', { ascending: false }); break;
      case 'oldest': query = query.order('created_at', { ascending: true }); break;
      case 'latest':
      default: query = query.order('created_at', { ascending: false }); break;
    }

    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      skills: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个技能详情
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('skills')
      .select('*, developers(id, name, avatar_url, skills_count, total_downloads)')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: '技能不存在' });
      throw error;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 认证 API ====================

// 发布新技能
router.post('/', auth, upload.fields([
  { name: 'zip', maxCount: 1 },
  { name: 'icon', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, version, category, tags, skill_json } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: '技能名称和描述为必填项' });
    }

    const skillId = uuidv4();
    let zipUrl = '';

    // 上传 ZIP 文件到 Supabase Storage
    if (req.files && req.files.zip && req.files.zip[0]) {
      const zipFile = req.files.zip[0];
      const zipPath = `skills/${req.developerId}/${skillId}/${zipFile.originalname}`;

      const { error: uploadErr } = await req.supabase.storage
        .from('skill-files')
        .upload(zipPath, zipFile.buffer, {
          contentType: 'application/zip',
          upsert: true
        });

      if (uploadErr) {
        console.error('ZIP 上传失败:', uploadErr);
        // 不阻塞，继续发布
      } else {
        const { data: publicUrl } = req.supabase.storage
          .from('skill-files')
          .getPublicUrl(zipPath);
        zipUrl = publicUrl.publicUrl;
      }
    }

    const skillData = {
      id: skillId,
      developer_id: req.developerId,
      name: name.trim(),
      description: description.trim(),
      version: version || '1.0.0',
      category: category || 'other',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      status: 'active',
      skill_json: skill_json || '{}',
      zip_url: zipUrl,
      zip_size: req.files?.zip?.[0]?.size || 0
    };

    const { data, error } = await req.supabase
      .from('skills')
      .insert(skillData)
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新技能
router.put('/:id', auth, upload.fields([
  { name: 'zip', maxCount: 1 },
  { name: 'icon', maxCount: 1 }
]), async (req, res) => {
  try {
    // 验证所有权
    const { data: skill, error: findErr } = await req.supabase
      .from('skills')
      .select('developer_id')
      .eq('id', req.params.id)
      .single();

    if (findErr) return res.status(404).json({ error: '技能不存在' });
    if (skill.developer_id !== req.developerId) {
      return res.status(403).json({ error: '无权修改此技能' });
    }

    const { name, description, version, category, tags, skill_json, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (version) updateData.version = version;
    if (category) updateData.category = category;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    if (skill_json) updateData.skill_json = skill_json;
    if (status) updateData.status = status;

    // 重新上传 ZIP
    if (req.files && req.files.zip && req.files.zip[0]) {
      const zipFile = req.files.zip[0];
      const zipPath = `skills/${req.developerId}/${req.params.id}/${zipFile.originalname}`;

      const { error: uploadErr } = await req.supabase.storage
        .from('skill-files')
        .upload(zipPath, zipFile.buffer, {
          contentType: 'application/zip',
          upsert: true
        });

      if (!uploadErr) {
        const { data: publicUrl } = req.supabase.storage
          .from('skill-files')
          .getPublicUrl(zipPath);
        updateData.zip_url = publicUrl.publicUrl;
        updateData.zip_size = zipFile.size;
      }
    }

    const { data, error } = await req.supabase
      .from('skills')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除技能
router.delete('/:id', auth, async (req, res) => {
  try {
    const { data: skill, error: findErr } = await req.supabase
      .from('skills')
      .select('developer_id')
      .eq('id', req.params.id)
      .single();

    if (findErr) return res.status(404).json({ error: '技能不存在' });
    if (skill.developer_id !== req.developerId) {
      return res.status(403).json({ error: '无权删除此技能' });
    }

    const { error } = await req.supabase
      .from('skills')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 记录下载
router.post('/:id/download', auth, async (req, res) => {
  try {
    const { data: skill, error: findErr } = await req.supabase
      .from('skills')
      .select('id, developer_id, zip_url')
      .eq('id', req.params.id)
      .single();

    if (findErr) return res.status(404).json({ error: '技能不存在' });

    // 记录下载
    const { error: insertErr } = await req.supabase
      .from('downloads')
      .insert({
        skill_id: req.params.id,
        developer_id: req.developerId
      });

    if (insertErr) console.error('下载记录失败:', insertErr);

    // 返回 ZIP 地址
    res.json({
      download_url: skill.zip_url,
      skill_id: skill.id,
      message: skill.zip_url ? '下载链接已生成' : '该技能暂无文件'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取我的技能列表
router.get('/my/skills', auth, async (req, res) => {
  try {
    const { data, error } = await req.supabase
      .from('skills')
      .select('*')
      .eq('developer_id', req.developerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
