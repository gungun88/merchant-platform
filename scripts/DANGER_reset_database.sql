-- ⚠️ 警告: 此脚本会删除所有数据和表结构
-- ⚠️ 仅在确认要完全重置数据库时执行
-- ⚠️ 建议:直接删除项目重新创建更安全

-- =============================================
-- 清空生产环境数据库 - 完全重置
-- =============================================

BEGIN;

-- 1. 删除所有 RLS 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. 删除所有触发器
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I CASCADE', r.trigger_name, r.event_object_table);
    END LOOP;
END $$;

-- 3. 删除所有函数
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
    ) LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I CASCADE', r.routine_name);
    END LOOP;
END $$;

-- 4. 删除所有表
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
END $$;

-- 5. 删除 Storage 中的 bucket
DELETE FROM storage.buckets WHERE id IN ('platform-assets', 'public');

-- 6. 删除 Storage 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- 7. 清理 Realtime publication
DO $$
BEGIN
    EXECUTE 'DROP PUBLICATION IF EXISTS supabase_realtime CASCADE';
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

COMMIT;

-- 验证清理结果
SELECT 'Tables remaining:' as status, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 'Functions remaining:', COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT 'Policies remaining:', COUNT(*)
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 'Triggers remaining:', COUNT(*)
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 显示清理完成消息
SELECT '✅ 数据库已完全清空,可以重新执行迁移脚本' as message;
