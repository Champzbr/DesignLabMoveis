-- r11: execute UMA VEZ no D1 existente, antes de publicar Worker r11.
-- Faz backup primeiro. Todas as contas nao administrativas aguardarao aprovacao.
ALTER TABLE users ADD COLUMN access_role TEXT NOT NULL DEFAULT 'geral';
ALTER TABLE users ADD COLUMN access_status TEXT NOT NULL DEFAULT 'pending';
UPDATE users SET access_role='admin',access_status='approved' WHERE role='admin';
-- Usuarios nao administradores, inclusive antigos, ficam pendentes ate aprovacao.
CREATE INDEX IF NOT EXISTS idx_users_access_status ON users(access_status);
