import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { Property, PropertyStatus, ListingType, StatusHistoryEntry } from '../database/db.ts';
import { randomUUID } from 'node:crypto';

export interface CreatePropertyInput {
  id?: string;
  seller_id: string;
  agent_id?: string | null;
  title: string;
  description?: string;
  price: number;
  listing_type: ListingType;
  property_type: string;
  location: string;
  image_url?: string | null;
  status?: PropertyStatus;
}

export interface UpdatePropertyInput {
  title?: string;
  description?: string;
  price?: number;
  listing_type?: ListingType;
  property_type?: string;
  location?: string;
  image_url?: string | null;
  agent_id?: string | null;
  status?: PropertyStatus;
}

export interface PropertyFilters {
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  propertyType?: string;
  listingType?: ListingType;
  status?: PropertyStatus;
  sellerId?: string;
  agentId?: string;
  limit?: number;
  offset?: number;
}

export class PropertyRepository {
  private db: SQLiteDatabase;

  // Allowed transitions
  // draft -> active
  // active -> draft, active -> under_offer
  // under_offer -> active (e.g. buyer cancelled), under_offer -> sold (sale only), under_offer -> rented (rent only)
  // sold -> TERMINAL (cannot go back to active or anything)
  // rented -> TERMINAL (cannot go back to active or anything)
  private static validTransitions: Record<PropertyStatus, PropertyStatus[]> = {
    draft: ['active'],
    active: ['draft', 'under_offer'],
    under_offer: ['active', 'sold', 'rented'],
    sold: [], // Forbidden to change once sold
    rented: [] // Forbidden to change once rented
  };

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
  }

  public create(input: CreatePropertyInput, createdBy?: string): Property {
    if (!input.title || input.title.trim().length < 3) {
      throw new Error('Title must have at least 3 characters');
    }
    if (!input.price || input.price <= 0) {
      throw new Error('Price must be greater than 0');
    }
    if (!['sale', 'rent'].includes(input.listing_type)) {
      throw new Error("listing_type must be either 'sale' or 'rent'");
    }
    if (!input.location || input.location.trim().length === 0) {
      throw new Error('Location cannot be empty');
    }
    if (!input.property_type || input.property_type.trim().length === 0) {
      throw new Error('Property type cannot be empty');
    }

    // Check seller exists and has role 'seller'
    const seller = this.db.get<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = ?`,
      [input.seller_id]
    );
    if (!seller) {
      throw new Error(`Seller '${input.seller_id}' not found`);
    }
    if (seller.role !== 'seller') {
      throw new Error(`User '${input.seller_id}' has role '${seller.role}', must be 'seller'`);
    }

    // Check agent if specified
    if (input.agent_id) {
      if (input.agent_id === input.seller_id) {
        throw new Error('Agent cannot be the same user as the seller');
      }
      const agent = this.db.get<{ id: string; role: string }>(
        `SELECT id, role FROM users WHERE id = ?`,
        [input.agent_id]
      );
      if (!agent) {
        throw new Error(`Agent '${input.agent_id}' not found`);
      }
      if (agent.role !== 'agent') {
        throw new Error(`User '${input.agent_id}' has role '${agent.role}', must be 'agent'`);
      }
    }

    const initialStatus: PropertyStatus = input.status || 'draft';
    if (!['draft', 'active'].includes(initialStatus)) {
      throw new Error(`Initial status must be 'draft' or 'active', got '${initialStatus}'`);
    }

    const id = input.id || randomUUID();

    return this.db.transaction(() => {
      this.db.run(
        `INSERT INTO properties (
          id, seller_id, agent_id, title, description, price, listing_type,
          property_type, location, image_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          id,
          input.seller_id,
          input.agent_id || null,
          input.title.trim(),
          input.description?.trim() || '',
          input.price,
          input.listing_type,
          input.property_type.trim(),
          input.location.trim(),
          input.image_url || null,
          initialStatus
        ]
      );

      // Log initial status in status_history
      this.db.run(
        `INSERT INTO status_history (id, property_id, old_status, new_status, changed_by, notes, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          randomUUID(),
          id,
          'none',
          initialStatus,
          createdBy || input.seller_id,
          'Property created'
        ]
      );

      return this.findById(id)!;
    });
  }

  public findById(id: string): Property | null {
    const row = this.db.get<Property>(`SELECT * FROM properties WHERE id = ?`, [id]);
    return row || null;
  }

  public findAll(filters: PropertyFilters = {}): Property[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.minPrice !== undefined) {
      conditions.push('price >= ?');
      params.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push('price <= ?');
      params.push(filters.maxPrice);
    }

    if (filters.location) {
      conditions.push('lower(location) LIKE ?');
      params.push(`%${filters.location.trim().toLowerCase()}%`);
    }

    if (filters.propertyType) {
      conditions.push('lower(property_type) = ?');
      params.push(filters.propertyType.trim().toLowerCase());
    }

    if (filters.listingType) {
      conditions.push('listing_type = ?');
      params.push(filters.listingType);
    }

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.sellerId) {
      conditions.push('seller_id = ?');
      params.push(filters.sellerId);
    }

    if (filters.agentId) {
      conditions.push('agent_id = ?');
      params.push(filters.agentId);
    }

    let sql = 'SELECT * FROM properties';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    if (filters.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    return this.db.query<Property>(sql, params);
  }

  public update(id: string, changes: UpdatePropertyInput, changedBy?: string, statusNotes?: string): Property {
    const current = this.findById(id);
    if (!current) {
      throw new Error(`Property '${id}' not found`);
    }

    // Constraint: "Verrouillage du prix et du type après Under Offer"
    const isPostUnderOffer = ['under_offer', 'sold', 'rented'].includes(current.status);
    if (isPostUnderOffer) {
      if (changes.price !== undefined && changes.price !== current.price) {
        throw new Error(
          `Cannot modify price after property has reached '${current.status}'. Field is locked.`
        );
      }
      if (changes.property_type !== undefined && changes.property_type !== current.property_type) {
        throw new Error(
          `Cannot modify property_type after property has reached '${current.status}'. Field is locked.`
        );
      }
      if (changes.listing_type !== undefined && changes.listing_type !== current.listing_type) {
        throw new Error(
          `Cannot modify listing_type after property has reached '${current.status}'. Field is locked.`
        );
      }
    }

    // Constraint: validate status transition if status is being updated
    let statusChanged = false;
    if (changes.status !== undefined && changes.status !== current.status) {
      this.validateStatusTransition(current.status, changes.status, current.listing_type);
      statusChanged = true;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (changes.title !== undefined) {
      if (changes.title.trim().length < 3) throw new Error('Title must have at least 3 characters');
      updates.push('title = ?');
      values.push(changes.title.trim());
    }

    if (changes.description !== undefined) {
      updates.push('description = ?');
      values.push(changes.description.trim());
    }

    if (changes.price !== undefined) {
      if (changes.price <= 0) throw new Error('Price must be greater than 0');
      updates.push('price = ?');
      values.push(changes.price);
    }

    if (changes.property_type !== undefined) {
      updates.push('property_type = ?');
      values.push(changes.property_type.trim());
    }

    if (changes.listing_type !== undefined) {
      if (!['sale', 'rent'].includes(changes.listing_type)) {
        throw new Error("listing_type must be 'sale' or 'rent'");
      }
      updates.push('listing_type = ?');
      values.push(changes.listing_type);
    }

    if (changes.location !== undefined) {
      updates.push('location = ?');
      values.push(changes.location.trim());
    }

    if (changes.image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(changes.image_url);
    }

    if (changes.agent_id !== undefined) {
      if (changes.agent_id) {
        if (changes.agent_id === current.seller_id) {
          throw new Error('Agent cannot be the same user as the seller');
        }
        const agent = this.db.get<{ id: string; role: string }>(
          `SELECT id, role FROM users WHERE id = ?`,
          [changes.agent_id]
        );
        if (!agent || agent.role !== 'agent') {
          throw new Error(`User '${changes.agent_id}' is not an agent`);
        }
      }
      updates.push('agent_id = ?');
      values.push(changes.agent_id);
    }

    if (statusChanged && changes.status) {
      updates.push('status = ?');
      values.push(changes.status);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push("updated_at = datetime('now')");

    return this.db.transaction(() => {
      values.push(id);
      this.db.run(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`, values);

      if (statusChanged && changes.status) {
        this.db.run(
          `INSERT INTO status_history (id, property_id, old_status, new_status, changed_by, notes, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            randomUUID(),
            id,
            current.status,
            changes.status,
            changedBy || null,
            statusNotes || `Status updated from ${current.status} to ${changes.status}`
          ]
        );
      }

      return this.findById(id)!;
    });
  }

  public updateStatus(
    id: string,
    newStatus: PropertyStatus,
    changedBy?: string,
    notes?: string
  ): Property {
    return this.update(id, { status: newStatus }, changedBy, notes);
  }

  public delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) {
      return false;
    }

    // Properties under offer or sold/rented should be archived or protected
    if (['under_offer', 'sold', 'rented'].includes(existing.status)) {
      throw new Error(`Cannot delete property with status '${existing.status}'`);
    }

    const result = this.db.run(`DELETE FROM properties WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  public getStatusHistory(propertyId: string): StatusHistoryEntry[] {
    return this.db.query<StatusHistoryEntry>(
      `SELECT * FROM status_history WHERE property_id = ? ORDER BY changed_at ASC`,
      [propertyId]
    );
  }

  private validateStatusTransition(
    currentStatus: PropertyStatus,
    targetStatus: PropertyStatus,
    listingType: ListingType
  ): void {
    if (currentStatus === targetStatus) {
      return;
    }

    // Specific constraint: "interdiction de repasser Sold -> Active"
    if (currentStatus === 'sold') {
      throw new Error(`Cannot transition from 'sold' to '${targetStatus}'. Terminal state.`);
    }

    if (currentStatus === 'rented') {
      throw new Error(`Cannot transition from 'rented' to '${targetStatus}'. Terminal state.`);
    }

    // Listing type constraints
    if (listingType === 'sale' && targetStatus === 'rented') {
      throw new Error(`A 'sale' property cannot have status 'rented'`);
    }
    if (listingType === 'rent' && targetStatus === 'sold') {
      throw new Error(`A 'rent' property cannot have status 'sold'`);
    }

    const allowed = PropertyRepository.validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ')}]`
      );
    }
  }

  // Agent metrics from project specifications (PDF page 4)
  public countActiveListingsByUser(userId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT count(*) as count FROM properties WHERE (seller_id = ? OR agent_id = ?) AND status = 'active'`,
      [userId, userId]
    );
    return row ? row.count : 0;
  }

  public getAveragePropertyPrice(listingType?: ListingType): number {
    let sql = `SELECT avg(price) as average FROM properties WHERE status = 'active'`;
    const params: any[] = [];
    if (listingType) {
      sql += ' AND listing_type = ?';
      params.push(listingType);
    }
    const row = this.db.get<{ average: number | null }>(sql, params);
    return row && row.average !== null ? Math.round(row.average * 100) / 100 : 0;
  }

  public countOffersPerProperty(propertyId: string): number {
    const row = this.db.get<{ count: number }>(
      `SELECT count(*) as count FROM offers WHERE property_id = ?`,
      [propertyId]
    );
    return row ? row.count : 0;
  }
}
