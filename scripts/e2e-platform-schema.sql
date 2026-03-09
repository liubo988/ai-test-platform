CREATE TABLE IF NOT EXISTS test_configurations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_uid VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  module_name VARCHAR(128) NOT NULL DEFAULT 'general',
  name VARCHAR(255) NOT NULL,
  target_url TEXT NOT NULL,
  feature_description TEXT NOT NULL,
  auth_required TINYINT(1) NOT NULL DEFAULT 0,
  login_url TEXT NULL,
  login_username VARCHAR(255) NULL,
  login_password_enc TEXT NULL,
  coverage_mode ENUM('all_tiers') NOT NULL DEFAULT 'all_tiers',
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_test_configurations_uid (config_uid),
  KEY idx_test_configurations_sort_order (sort_order),
  KEY idx_test_configurations_module_name (module_name),
  KEY idx_test_configurations_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_uid VARCHAR(64) NOT NULL,
  config_uid VARCHAR(64) NOT NULL,
  plan_title VARCHAR(255) NOT NULL,
  plan_version INT NOT NULL,
  plan_code LONGTEXT NOT NULL,
  plan_summary TEXT NULL,
  tier_simple_count INT NOT NULL DEFAULT 0,
  tier_medium_count INT NOT NULL DEFAULT 0,
  tier_complex_count INT NOT NULL DEFAULT 0,
  generation_model VARCHAR(128) NULL,
  generation_prompt LONGTEXT NULL,
  generated_files_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_test_plans_uid (plan_uid),
  KEY idx_test_plans_config_version (config_uid, plan_version),
  CONSTRAINT fk_test_plans_config_uid FOREIGN KEY (config_uid) REFERENCES test_configurations (config_uid)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_plan_cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_uid VARCHAR(64) NOT NULL,
  plan_uid VARCHAR(64) NOT NULL,
  tier ENUM('simple', 'medium', 'complex') NOT NULL,
  case_name VARCHAR(255) NOT NULL,
  case_steps JSON NULL,
  expected_result TEXT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_test_plan_cases_uid (case_uid),
  KEY idx_test_plan_cases_plan_sort (plan_uid, sort_order),
  CONSTRAINT fk_test_plan_cases_plan_uid FOREIGN KEY (plan_uid) REFERENCES test_plans (plan_uid)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_executions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  execution_uid VARCHAR(64) NOT NULL,
  plan_uid VARCHAR(64) NOT NULL,
  config_uid VARCHAR(64) NOT NULL,
  trigger_source ENUM('manual', 'api') NOT NULL DEFAULT 'manual',
  status ENUM('queued', 'running', 'passed', 'failed', 'canceled') NOT NULL DEFAULT 'queued',
  started_at DATETIME(3) NULL,
  ended_at DATETIME(3) NULL,
  duration_ms INT NULL,
  result_summary TEXT NULL,
  error_message LONGTEXT NULL,
  worker_session_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_test_executions_uid (execution_uid),
  KEY idx_test_executions_plan_status (plan_uid, status, created_at),
  KEY idx_test_executions_config_created (config_uid, created_at),
  CONSTRAINT fk_test_executions_plan_uid FOREIGN KEY (plan_uid) REFERENCES test_plans (plan_uid)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_test_executions_config_uid FOREIGN KEY (config_uid) REFERENCES test_configurations (config_uid)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS llm_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_uid VARCHAR(64) NOT NULL,
  scene ENUM('plan_generation', 'plan_execution') NOT NULL,
  ref_uid VARCHAR(64) NOT NULL,
  role ENUM('system', 'user', 'assistant', 'tool') NOT NULL,
  message_type ENUM('thinking', 'code', 'status', 'error') NOT NULL,
  content LONGTEXT NOT NULL,
  token_usage_prompt INT NULL,
  token_usage_completion INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_llm_conversations_uid (conversation_uid),
  KEY idx_llm_conversations_scene_ref_time (scene, ref_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS execution_stream_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  execution_uid VARCHAR(64) NOT NULL,
  event_type ENUM('frame', 'log', 'step', 'artifact', 'status') NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_execution_stream_events_execution_time (execution_uid, created_at),
  CONSTRAINT fk_execution_stream_events_execution_uid FOREIGN KEY (execution_uid) REFERENCES test_executions (execution_uid)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS execution_artifacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  execution_uid VARCHAR(64) NOT NULL,
  artifact_type ENUM('video', 'screenshot', 'trace', 'report', 'generated_spec') NOT NULL,
  storage_path TEXT NOT NULL,
  meta JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_execution_artifacts_execution_time (execution_uid, created_at),
  CONSTRAINT fk_execution_artifacts_execution_uid FOREIGN KEY (execution_uid) REFERENCES test_executions (execution_uid)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
