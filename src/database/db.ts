import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';

export type UserRole = 'buyer' | 'seller' | 'agent';

export interface User {
  id: string;
  username: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type ListingType = 'sale' | 'rent';
export type PropertyStatus = 'draft' | 'active' | 'under_offer' | 'sold' | 'rented';

export interface Property {
  id: string;
  seller_id: string;
  agent_id: string | null;
  title: string;
  description: string;
  price: number;
  listing_type: ListingType;
  property_type: string;
  location: string;
  image_url: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  property_id: string;
  old_status: string;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  changed_at: string;
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected';

export interface Offer {
  id: string;
  property_id: string;
  buyer_id: string;
  amount: number;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
}

export type RentalStatus = 'pending' | 'accepted' | 'rejected';

export interface RentalApplication {
  id: string;
  property_id: string;
  buyer_id: string;
  move_in_date: string;
  notes: string | null;
  status: RentalStatus;
  created_at: string;
  updated_at: string;
}

export class SQLiteDatabase {
  public db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'agent')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        agent_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL CHECK (price > 0),
        listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
        property_type TEXT NOT NULL,
        location TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'under_offer', 'sold', 'rented')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK (agent_id IS NULL OR agent_id <> seller_id),
        CHECK (NOT (listing_type = 'sale' AND status = 'rented')),
        CHECK (NOT (listing_type = 'rent' AND status = 'sold'))
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        old_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        changed_by TEXT REFERENCES users(id),
        notes TEXT,
        changed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS offers (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount REAL NOT NULL CHECK (amount > 0),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rental_applications (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        move_in_date TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_properties_seller ON properties(seller_id);
      CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
      CREATE INDEX IF NOT EXISTS idx_properties_catalogue ON properties(status, listing_type, price);
      CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location);
      CREATE INDEX IF NOT EXISTS idx_status_history_prop ON status_history(property_id);
      CREATE INDEX IF NOT EXISTS idx_offers_prop ON offers(property_id);
      CREATE INDEX IF NOT EXISTS idx_rentals_prop ON rental_applications(property_id);
    `);
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public get<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(callback: () => T): T {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Rollback failed if transaction was already closed
      }
      throw error;
    }
  }

  public close(): void {
    this.db.close();
  }
}

// Singleton database instance for application default use
let defaultInstance: SQLiteDatabase | null = null;

export function getDatabase(dbPath?: string): SQLiteDatabase {
  if (dbPath) {
    return new SQLiteDatabase(dbPath);
  }
  if (!defaultInstance) {
    const defaultPath = path.resolve(process.cwd(), 'holmia.db');
    defaultInstance = new SQLiteDatabase(defaultPath);
  }
  return defaultInstance;
}
