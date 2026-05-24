const crypto = require('crypto');

/**
 * Agent World Key 认证中间件
 * 支持格式: sk_xxx, agent-world-xxx
 * 注入 req.developerId, req.keyHash
 */
async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: '缺少认证头 Authorization' });
  }

  // 支持 Bearer token 和直接 key
  let key = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    key = authHeader.slice(7);
  }
  key = key.trim();

  // 格式验证
  if (!key.startsWith('sk_') && !key.startsWith('agent-world-')) {
    return res.status(401).json({ error: '无效的 API Key 格式，需要 sk_ 或 agent-world- 前缀' });
  }

  if (key.length < 20) {
    return res.status(401).json({ error: 'API Key 长度不足' });
  }

  // 计算 key hash 用于标识开发者
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  // 尝试通过 Agent World API 验证 (可选，失败不阻塞)
  // try {
  //   const verifyRes = await fetch(`${process.env.AGENT_WORLD_API}/verify`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ key })
  //   });
  //   if (!verifyRes.ok) {
  //     return res.status(403).json({ error: 'API Key 验证失败' });
  //   }
  // } catch (err) {
  //   // Agent World API 不可达时降级为本地验证
  //   console.warn('Agent World API 不可达，使用本地验证');
  // }

  req.keyHash = keyHash;
  req.apiKey = key;

  // 查找或创建开发者
  const { supabase } = req;
  if (supabase) {
    try {
      let { data: dev } = await supabase
        .from('developers')
        .select('id, name')
        .eq('key_hash', keyHash)
        .single();

      if (!dev) {
        // 自动注册新开发者
        const shortId = key.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');
        const { data: newDev, error: createErr } = await supabase
          .from('developers')
          .insert({
            key_hash: keyHash,
            name: `Dev_${shortId}`
          })
          .select('id, name')
          .single();

        if (createErr) throw createErr;
        dev = newDev;
      }

      req.developerId = dev.id;
      req.developerName = dev.name;
    } catch (err) {
      console.error('开发者查找/创建失败:', err.message);
      // 不阻塞，继续使用 keyHash 作为标识
      req.developerId = keyHash;
      req.developerName = `Dev_${keyHash.slice(0, 8)}`;
    }
  } else {
    // 无 Supabase 时降级
    req.developerId = keyHash;
    req.developerName = `Dev_${keyHash.slice(0, 8)}`;
  }

  next();
}

module.exports = auth;
