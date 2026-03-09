-- Migration: 2026-03-09
-- 1. 补充 test_projects 表缺失的 cover_image_url 列
-- 2. 补充 test_modules 表的 (project_uid, name) 唯一约束

-- 问题：新建项目时报 Unknown column 'cover_image_url'
ALTER TABLE test_projects
  ADD COLUMN cover_image_url TEXT NULL AFTER description;

-- 问题：修改模块名称时报 Duplicate entry，但 schema 未记录此约束
-- 如果数据库已存在此约束则跳过（执行前请先确认）
-- ALTER TABLE test_modules
--   ADD UNIQUE KEY uk_test_modules_project_name (project_uid, name);
