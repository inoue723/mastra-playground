import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export type SkillStatus = 'active' | 'inactive';

export type UserSkill = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
  status: SkillStatus;
  createdAt: string;
  updatedAt: string;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let schemaReady: Promise<void> | undefined;

function ensureSchema() {
  schemaReady ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS user_skills (
        id UUID PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, slug)
      )
    `)
    .then(() => undefined);
  return schemaReady;
}

const columns = `
  id,
  user_id AS "userId",
  name,
  slug,
  description,
  instructions,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export const skillRepository = {
  async list(userId: string, status?: SkillStatus) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `SELECT ${columns} FROM user_skills WHERE user_id = $1
       AND ($2::text IS NULL OR status = $2::text)
       ORDER BY updated_at DESC`,
      [userId, status ?? null],
    );
    return result.rows;
  },

  async listActive(userId: string, skillId?: string) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `SELECT ${columns}
       FROM user_skills
       WHERE user_id = $1 AND status = 'active'
         AND ($2::uuid IS NULL OR id = $2::uuid)
       ORDER BY updated_at DESC`,
      [userId, skillId ?? null],
    );
    return result.rows;
  },

  async get(userId: string, id: string) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `SELECT ${columns} FROM user_skills WHERE user_id = $1 AND id = $2`,
      [userId, id],
    );
    return result.rows[0] ?? null;
  },

  async create(input: {
    userId: string;
    name: string;
    slug: string;
    description: string;
    instructions: string;
  }) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `INSERT INTO user_skills (id, user_id, name, slug, description, instructions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${columns}`,
      [randomUUID(), input.userId, input.name, input.slug, input.description, input.instructions],
    );
    return result.rows[0]!;
  },

  async update(userId: string, id: string, input: Partial<Pick<UserSkill, 'name' | 'slug' | 'description' | 'instructions'>>) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `UPDATE user_skills
       SET name = COALESCE($3, name), slug = COALESCE($4, slug),
           description = COALESCE($5, description), instructions = COALESCE($6, instructions),
           updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING ${columns}`,
      [userId, id, input.name ?? null, input.slug ?? null, input.description ?? null, input.instructions ?? null],
    );
    return result.rows[0] ?? null;
  },

  async setStatus(userId: string, id: string, status: SkillStatus) {
    await ensureSchema();
    const result = await pool.query<UserSkill>(
      `UPDATE user_skills SET status = $3, updated_at = now()
       WHERE user_id = $1 AND id = $2 RETURNING ${columns}`,
      [userId, id, status],
    );
    return result.rows[0] ?? null;
  },

  async remove(userId: string, id: string) {
    await ensureSchema();
    const result = await pool.query(`DELETE FROM user_skills WHERE user_id = $1 AND id = $2`, [userId, id]);
    return result.rowCount === 1;
  },
};
