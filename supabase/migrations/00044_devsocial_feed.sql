-- DevSocial Feed — Phase 6 Sprint 2
--
-- Twitter-style feed tuned for the tech/dev community. Posts can
-- carry a short text body plus an optional code snippet (with
-- language), an optional image, plus hashtags and tech stack tags.
-- Likes + reports are split into their own tables so we can count
-- them cheaply and enforce one-like-per-user.
--
-- Moderation is designed to be cheap from day one: every post has a
-- `status` column ('active' | 'hidden' | 'deleted') so admins can
-- soft-hide without blowing away the row. Reports are lightweight
-- (reason + reporter) and admins work from an `open` queue.

CREATE TABLE IF NOT EXISTS public.posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),

  -- Optional code snippet — language is free-form so we can pass
  -- whatever Shiki/Prism recognise ('typescript', 'tsx', 'sql', …).
  code_snippet      TEXT,
  code_language     TEXT,

  image_url         TEXT,

  -- Arrays rather than a join table — hashtags/stack are small,
  -- read-only from the app's POV, and trivial to GIN-index.
  hashtags          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tech_stack_tags   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Optional product showcase — lets sellers link a CodeVault
  -- product card directly to a post. ON DELETE SET NULL so deleting
  -- a product doesn't vaporise the post.
  product_id        UUID REFERENCES public.products(id) ON DELETE SET NULL,

  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'hidden', 'deleted')),

  like_count        INTEGER NOT NULL DEFAULT 0,
  comment_count     INTEGER NOT NULL DEFAULT 0,
  report_count      INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts(created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_posts_author
  ON public.posts(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_hashtags
  ON public.posts USING GIN (hashtags);

CREATE INDEX IF NOT EXISTS idx_posts_tech_stack
  ON public.posts USING GIN (tech_stack_tags);

-- ─── Likes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user
  ON public.post_likes(user_id, created_at DESC);

-- Trigger: keep like_count on posts in sync automatically.
CREATE OR REPLACE FUNCTION public.posts_like_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.posts_like_count_trigger();

-- ─── Comments (schema now, UI in Sprint 3) ─────────────────────────
-- 1-level deep only — no parent_comment_id on purpose. Reddit-style
-- nesting makes moderation horrible; we won't be going there.
CREATE TABLE IF NOT EXISTS public.post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post
  ON public.post_comments(post_id, created_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.posts_comment_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status <> 'active' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'active' AND NEW.status = 'active' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.posts_comment_count_trigger();

-- ─── Reports (moderation from day one) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL CHECK (reason IN (
                  'spam', 'harassment', 'nsfw', 'misinformation',
                  'off_topic', 'other')),
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reports_open
  ON public.post_reports(created_at DESC)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.posts_report_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET report_count = report_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_reports_count ON public.post_reports;
CREATE TRIGGER trg_post_reports_count
AFTER INSERT ON public.post_reports
FOR EACH ROW EXECUTE FUNCTION public.posts_report_count_trigger();

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports   ENABLE ROW LEVEL SECURITY;

-- Everyone (including logged-out users) can read active posts.
DROP POLICY IF EXISTS "posts_read_active" ON public.posts;
CREATE POLICY "posts_read_active" ON public.posts
  FOR SELECT USING (status = 'active');

-- Authors can see their own posts regardless of status (so they can
-- see a hidden-by-mod post and know what happened).
DROP POLICY IF EXISTS "posts_read_own" ON public.posts;
CREATE POLICY "posts_read_own" ON public.posts
  FOR SELECT USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

-- Likes — readable to everyone (so we can show "liked by" later),
-- writable only as self.
DROP POLICY IF EXISTS "likes_read_all" ON public.post_likes;
CREATE POLICY "likes_read_all" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "likes_insert_self" ON public.post_likes;
CREATE POLICY "likes_insert_self" ON public.post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_delete_self" ON public.post_likes;
CREATE POLICY "likes_delete_self" ON public.post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Comments — active comments visible to all; authors + admins can mutate.
DROP POLICY IF EXISTS "comments_read_active" ON public.post_comments;
CREATE POLICY "comments_read_active" ON public.post_comments
  FOR SELECT USING (status = 'active' OR auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_insert_self" ON public.post_comments;
CREATE POLICY "comments_insert_self" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "comments_update_own" ON public.post_comments;
CREATE POLICY "comments_update_own" ON public.post_comments
  FOR UPDATE USING (auth.uid() = author_id);

-- Reports — authors can insert, nobody reads directly (admin RPC handles that).
DROP POLICY IF EXISTS "reports_insert_self" ON public.post_reports;
CREATE POLICY "reports_insert_self" ON public.post_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ─── Feed RPC ──────────────────────────────────────────────────────
-- Returns a page of active posts plus whether the viewer has liked
-- each one. Sort: 'new' = chronological DESC, 'trending' = hot-score
-- blending recency + like velocity.
CREATE OR REPLACE FUNCTION public.get_feed(
  p_viewer_id   UUID DEFAULT NULL,
  p_sort        TEXT DEFAULT 'new',     -- 'new' | 'trending'
  p_hashtag     TEXT DEFAULT NULL,      -- lowercase, no '#'
  p_limit       INTEGER DEFAULT 20,
  p_before      TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  author_id        UUID,
  body             TEXT,
  code_snippet     TEXT,
  code_language    TEXT,
  image_url        TEXT,
  hashtags         TEXT[],
  tech_stack_tags  TEXT[],
  product_id       UUID,
  like_count       INTEGER,
  comment_count    INTEGER,
  created_at       TIMESTAMPTZ,
  author_name      TEXT,
  author_avatar    TEXT,
  author_role      TEXT,
  author_rank_key  TEXT,
  author_buyer_tier TEXT,
  viewer_liked     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.author_id,
    p.body,
    p.code_snippet,
    p.code_language,
    p.image_url,
    p.hashtags,
    p.tech_stack_tags,
    p.product_id,
    p.like_count,
    p.comment_count,
    p.created_at,
    u.display_name          AS author_name,
    u.avatar_url            AS author_avatar,
    u.role::text            AS author_role,
    u.seller_rank_key       AS author_rank_key,
    u.buyer_tier::text      AS author_buyer_tier,
    CASE
      WHEN p_viewer_id IS NULL THEN FALSE
      ELSE EXISTS (
        SELECT 1 FROM public.post_likes pl
        WHERE pl.post_id = p.id AND pl.user_id = p_viewer_id
      )
    END AS viewer_liked
  FROM public.posts p
  JOIN public.users u ON u.id = p.author_id
  WHERE p.status = 'active'
    AND (p_before IS NULL OR p.created_at < p_before)
    AND (p_hashtag IS NULL OR p_hashtag = ANY(p.hashtags))
  ORDER BY
    CASE WHEN p_sort = 'trending' THEN
      -- Simple hot-score: likes decayed by age in hours (Reddit-ish).
      (p.like_count + 1)::float
        / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0, 1), 1.3)
    ELSE
      0
    END DESC,
    p.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_feed(UUID, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
  TO anon, authenticated;

-- ─── Trending hashtags RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trending_hashtags(
  p_hours   INTEGER DEFAULT 72,
  p_limit   INTEGER DEFAULT 10
)
RETURNS TABLE (
  tag         TEXT,
  post_count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    lower(tag) AS tag,
    COUNT(*)::bigint AS post_count
  FROM public.posts p, unnest(p.hashtags) AS tag
  WHERE p.status = 'active'
    AND p.created_at > NOW() - (p_hours || ' hours')::interval
  GROUP BY lower(tag)
  ORDER BY post_count DESC, tag ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(INTEGER, INTEGER)
  TO anon, authenticated;
