import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { RentalApplication, RentalStatus, Property } from '../database/db.ts';
import { randomUUID } from 'node:crypto';

export interface CreateRentalInput {
  id?: string;
  property_id: string;
  buyer_id: string;
  move_in_date: string;
  notes?: string | null;
}

export interface UpdateRentalInput {
  move_in_date?: string;
  notes?: string | null;
  status?: RentalStatus;
}

export class RentalRepository {
  private db: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
  }

  public create(input: CreateRentalInput): RentalApplication {
    if (!input.move_in_date || input.move_in_date.trim().length === 0) {
      throw new Error('move_in_date is required');
    }

    // Verify buyer exists and has role 'buyer'
    const buyer = this.db.get<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = ?`,
      [input.buyer_id]
    );
    if (!buyer) {
      throw new Error(`Buyer '${input.buyer_id}' not found`);
    }
    if (buyer.role !== 'buyer') {
      throw new Error(`User '${input.buyer_id}' has role '${buyer.role}', only buyers can apply for rental`);
    }

    // Verify property exists, is for rent, and is active
    const property = this.db.get<Property>(
      `SELECT * FROM properties WHERE id = ?`,
      [input.property_id]
    );
    if (!property) {
      throw new Error(`Property '${input.property_id}' not found`);
    }
    if (property.listing_type !== 'rent') {
      throw new Error(
        `Cannot submit rental application: property '${input.property_id}' is for '${property.listing_type}', not 'rent'`
      );
    }
    if (property.status !== 'active') {
      throw new Error(
        `Cannot apply for rental: property status is '${property.status}', must be 'active'`
      );
    }

    const id = input.id || randomUUID();

    this.db.run(
      `INSERT INTO rental_applications (id, property_id, buyer_id, move_in_date, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
      [id, input.property_id, input.buyer_id, input.move_in_date.trim(), input.notes?.trim() || null]
    );

    return this.findById(id)!;
  }

  public findById(id: string): RentalApplication | null {
    const row = this.db.get<RentalApplication>(
      `SELECT * FROM rental_applications WHERE id = ?`,
      [id]
    );
    return row || null;
  }

  public findByPropertyId(propertyId: string): RentalApplication[] {
    return this.db.query<RentalApplication>(
      `SELECT * FROM rental_applications WHERE property_id = ? ORDER BY created_at DESC`,
      [propertyId]
    );
  }

  public findByBuyerId(buyerId: string): RentalApplication[] {
    return this.db.query<RentalApplication>(
      `SELECT * FROM rental_applications WHERE buyer_id = ? ORDER BY created_at DESC`,
      [buyerId]
    );
  }

  public update(id: string, changes: UpdateRentalInput): RentalApplication {
    const current = this.findById(id);
    if (!current) {
      throw new Error(`Rental application '${id}' not found`);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (changes.move_in_date !== undefined) {
      if (changes.move_in_date.trim().length === 0) {
        throw new Error('move_in_date cannot be empty');
      }
      updates.push('move_in_date = ?');
      values.push(changes.move_in_date.trim());
    }

    if (changes.notes !== undefined) {
      updates.push('notes = ?');
      values.push(changes.notes?.trim() || null);
    }

    if (changes.status !== undefined) {
      const validStatuses: RentalStatus[] = ['pending', 'accepted', 'rejected'];
      if (!validStatuses.includes(changes.status)) {
        throw new Error(`Invalid status '${changes.status}'`);
      }
      updates.push('status = ?');
      values.push(changes.status);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    this.db.run(`UPDATE rental_applications SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id)!;
  }

  public delete(id: string): boolean {
    const current = this.findById(id);
    if (!current) {
      return false;
    }
    const result = this.db.run(`DELETE FROM rental_applications WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  public acceptApplication(id: string, _actorId?: string): RentalApplication {
    const app = this.findById(id);
    if (!app) {
      throw new Error(`Rental application '${id}' not found`);
    }
    if (app.status !== 'pending') {
      throw new Error(`Cannot accept application with status '${app.status}'`);
    }

    this.db.run(
      `UPDATE rental_applications SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );
    return this.findById(id)!;
  }

  public rejectApplication(id: string): RentalApplication {
    const app = this.findById(id);
    if (!app) {
      throw new Error(`Rental application '${id}' not found`);
    }
    if (app.status !== 'pending') {
      throw new Error(`Cannot reject application with status '${app.status}'`);
    }

    this.db.run(
      `UPDATE rental_applications SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );
    return this.findById(id)!;
  }
}
