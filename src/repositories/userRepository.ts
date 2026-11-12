import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { User, UserRole } from '../database/db.ts';
import { randomUUID } from 'node:crypto';

export interface CreateUserInput {
  id?: string;
  username?: string | null;
  full_name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserInput {
  username?: string | null;
  full_name?: string;
  email?: string;
  role?: UserRole;
}

export class UserRepository {
  private db: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
  }

  public create(input: CreateUserInput): User {
    if (!input.full_name || input.full_name.trim().length === 0) {
      throw new Error('User full_name cannot be empty');
    }
    if (!input.email || !input.email.includes('@')) {
      throw new Error('A valid email is required');
    }
    const validRoles: UserRole[] = ['buyer', 'seller', 'agent'];
    if (!validRoles.includes(input.role)) {
      throw new Error(`Invalid role '${input.role}'. Allowed roles are: ${validRoles.join(', ')}`);
    }

    const id = input.id || randomUUID();
    const username = input.username?.trim() || null;
    const fullName = input.full_name.trim();
    const email = input.email.trim().toLowerCase();

    // Check duplicate email
    const existing = this.findByEmail(email);
    if (existing) {
      throw new Error(`A user with email '${email}' already exists`);
    }

    this.db.run(
      `INSERT INTO users (id, username, full_name, email, role, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, username, fullName, email, input.role]
    );

    const created = this.findById(id);
    if (!created) {
      throw new Error('Failed to retrieve user after creation');
    }
    return created;
  }

  public findById(id: string): User | null {
    const row = this.db.get<User>(`SELECT * FROM users WHERE id = ?`, [id]);
    return row || null;
  }

  public findByEmail(email: string): User | null {
    const row = this.db.get<User>(
      `SELECT * FROM users WHERE lower(email) = lower(?)`,
      [email.trim()]
    );
    return row || null;
  }

  public findByUsername(username: string): User | null {
    const row = this.db.get<User>(
      `SELECT * FROM users WHERE lower(username) = lower(?)`,
      [username.trim()]
    );
    return row || null;
  }

  public findAll(filter?: { role?: UserRole }): User[] {
    if (filter?.role) {
      return this.db.query<User>(
        `SELECT * FROM users WHERE role = ? ORDER BY created_at DESC`,
        [filter.role]
      );
    }
    return this.db.query<User>(`SELECT * FROM users ORDER BY created_at DESC`);
  }

  public update(id: string, changes: UpdateUserInput): User {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error(`User with ID '${id}' not found`);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (changes.full_name !== undefined) {
      if (changes.full_name.trim().length === 0) {
        throw new Error('User full_name cannot be empty');
      }
      updates.push('full_name = ?');
      values.push(changes.full_name.trim());
    }

    if (changes.username !== undefined) {
      updates.push('username = ?');
      values.push(changes.username?.trim() || null);
    }

    if (changes.email !== undefined) {
      if (!changes.email.includes('@')) {
        throw new Error('A valid email is required');
      }
      const email = changes.email.trim().toLowerCase();
      const duplicate = this.findByEmail(email);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Email '${email}' is already in use by another user`);
      }
      updates.push('email = ?');
      values.push(email);
    }

    if (changes.role !== undefined) {
      const validRoles: UserRole[] = ['buyer', 'seller', 'agent'];
      if (!validRoles.includes(changes.role)) {
        throw new Error(`Invalid role '${changes.role}'`);
      }
      updates.push('role = ?');
      values.push(changes.role);
    }

    if (updates.length === 0) {
      return existing;
    }

    values.push(id);
    this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    return this.findById(id)!;
  }

  public delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) {
      return false;
    }

    // Check if user has associated properties or offers
    const hasProps = this.db.get<{ count: number }>(
      `SELECT count(*) as count FROM properties WHERE seller_id = ? OR agent_id = ?`,
      [id, id]
    );
    if (hasProps && hasProps.count > 0) {
      throw new Error(`Cannot delete user '${id}': user is associated with ${hasProps.count} properties`);
    }

    const result = this.db.run(`DELETE FROM users WHERE id = ?`, [id]);
    return result.changes > 0;
  }
}
