-- SkillHub 数据库 Schema (Supabase PostgreSQL)
-- 在 Supabase SQL Editor 中执行此文件

-- 开发者表
CREATE TABLE developers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_world_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  website TEXT,
  skill_count INT DEFAULT 0,
  total_downloads INT DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 技能表
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES developers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  category TEXT,
  tags TEXT[],
  zip_url TEXT,
  zip_size INT,
  readme TEXT,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  download_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 评测/评论表
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  developer_id UUID REFERENCES developers(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 下载记录表
CREATE TABLE downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_developers_updated_at BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 评分触发器
CREATE OR REPLACE FUNCTION update_skill_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE skills SET
    avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id)),
    review_count = (SELECT COUNT(*) FROM reviews WHERE skill_id = COALESCE(NEW.skill_id, OLD.skill_id))
  WHERE id = COALESCE(NEW.skill_id, OLD.skill_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_skill_rating();

-- 下载计数触发器
CREATE OR REPLACE FUNCTION update_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE skills SET download_count = download_count + 1 WHERE id = NEW.skill_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_download_on_insert AFTER INSERT ON downloads
  FOR EACH ROW EXECUTE FUNCTION update_download_count();

-- 开发者统计触发器
CREATE OR REPLACE FUNCTION update_developer_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE developers SET
    skill_count = (SELECT COUNT(*) FROM skills WHERE developer_id = COALESCE(NEW.developer_id, OLD.developer_id) AND status = 'active'),
    total_downloads = COALESCE((SELECT SUM(download_count) FROM skills WHERE developer_id = COALESCE(NEW.developer_id, OLD.developer_id)), 0),
    avg_rating = COALESCE((SELECT AVG(avg_rating) FROM skills WHERE developer_id = COALESCE(NEW.developer_id, OLD.developer_id) AND status = 'active'), 0)
  WHERE id = COALESCE(NEW.developer_id, OLD.developer_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dev_stats_on_skill_change AFTER INSERT OR UPDATE OR DELETE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_developer_stats();

-- RLS
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read developers" ON developers FOR SELECT USING (true);
CREATE POLICY "Public read skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Insert own developer" ON developers FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own developer" ON developers FOR UPDATE USING (true);
CREATE POLICY "Insert own skill" ON skills FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own skill" ON skills FOR UPDATE USING (true);
CREATE POLICY "Insert review" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert download" ON downloads FOR INSERT WITH CHECK (true);
