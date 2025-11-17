-- ghdxodnd@gmail.com 계정을 관리자로 설정
UPDATE auth.users
SET
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    'true'::jsonb
  )
WHERE email = 'ghdxodnd@gmail.com';
