import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { Offer, OfferStatus, Property } from '../database/db.ts';
import { randomUUID } from 'node:crypto';

export interface CreateOfferInput {
  id?: string;
  property_id: string;
  buyer_id: string;
  amount: number;
}

export interface UpdateOfferInput {
  amount?: number;
  status?: OfferStatus;
}

export class OfferRepository {
  private db: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
  }

  public create(input: CreateOfferInput): Offer {
    if (!input.amount || input.amount <= 0) {
      throw new Error('Offer amount must be greater than 0');
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
      throw new Error(`User '${input.buyer_id}' is a '${buyer.role}', only buyers can submit offers`);
    }

    // Verify property exists, is for sale, and is active
    const property = this.db.get<Property>(
      `SELECT * FROM properties WHERE id = ?`,
      [input.property_id]
    );
    if (!property) {
      throw new Error(`Property '${input.property_id}' not found`);
    }
    if (property.listing_type !== 'sale') {
      throw new Error(
        `Cannot submit purchase offer: property '${input.property_id}' is for '${property.listing_type}', not 'sale'`
      );
    }
    if (property.status !== 'active') {
      throw new Error(
        `Cannot submit offer: property status is '${property.status}', must be 'active'`
      );
    }

    const id = input.id || randomUUID();

    this.db.run(
      `INSERT INTO offers (id, property_id, buyer_id, amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
      [id, input.property_id, input.buyer_id, input.amount]
    );

    return this.findById(id)!;
  }

  public findById(id: string): Offer | null {
    const row = this.db.get<Offer>(`SELECT * FROM offers WHERE id = ?`, [id]);
    return row || null;
  }

  public findByPropertyId(propertyId: string): Offer[] {
    return this.db.query<Offer>(
      `SELECT * FROM offers WHERE property_id = ? ORDER BY created_at DESC`,
      [propertyId]
    );
  }

  public findByBuyerId(buyerId: string): Offer[] {
    return this.db.query<Offer>(
      `SELECT * FROM offers WHERE buyer_id = ? ORDER BY created_at DESC`,
      [buyerId]
    );
  }

  public update(id: string, changes: UpdateOfferInput): Offer {
    const current = this.findById(id);
    if (!current) {
      throw new Error(`Offer '${id}' not found`);
    }

    if (current.status !== 'pending' && changes.amount !== undefined) {
      throw new Error(`Cannot modify amount of an offer with status '${current.status}'`);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (changes.amount !== undefined) {
      if (changes.amount <= 0) throw new Error('Amount must be greater than 0');
      updates.push('amount = ?');
      values.push(changes.amount);
    }

    if (changes.status !== undefined) {
      const validStatuses: OfferStatus[] = ['pending', 'accepted', 'rejected'];
      if (!validStatuses.includes(changes.status)) {
        throw new Error(`Invalid offer status '${changes.status}'`);
      }
      updates.push('status = ?');
      values.push(changes.status);
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    this.db.run(`UPDATE offers SET ${updates.join(', ')} WHERE id = ?`, values);
    return this.findById(id)!;
  }

  public delete(id: string): boolean {
    const current = this.findById(id);
    if (!current) {
      return false;
    }
    if (current.status === 'accepted') {
      throw new Error(`Cannot delete an accepted offer`);
    }
    const result = this.db.run(`DELETE FROM offers WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  /**
   * ATOMIC ACCEPTANCE:
   * 1. Validates that offer is pending
   * 2. Validates that property is active
   * 3. Sets target offer to 'accepted'
   * 4. Automatically sets all other pending offers for this property to 'rejected'
   * 5. Transitions property status from 'active' to 'under_offer'
   * 6. Records the transition in status_history
   * All executed within a single ACID transaction.
   */
  public acceptOffer(
    offerId: string,
    acceptedBy?: string,
    notes?: string
  ): {
    acceptedOffer: Offer;
    rejectedOffersCount: number;
    property: Property;
  } {
    return this.db.transaction(() => {
      const offer = this.findById(offerId);
      if (!offer) {
        throw new Error(`Offer '${offerId}' not found`);
      }
      if (offer.status !== 'pending') {
        throw new Error(`Cannot accept offer '${offerId}': current status is '${offer.status}', expected 'pending'`);
      }

      const property = this.db.get<Property>(
        `SELECT * FROM properties WHERE id = ?`,
        [offer.property_id]
      );
      if (!property) {
        throw new Error(`Property '${offer.property_id}' not found`);
      }
      if (property.status !== 'active') {
        throw new Error(
          `Cannot accept offer: property status is '${property.status}', must be 'active'`
        );
      }

      // 1. Accept target offer
      this.db.run(
        `UPDATE offers SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`,
        [offerId]
      );

      // 2. Reject all other pending offers for this property
      const rejectResult = this.db.run(
        `UPDATE offers SET status = 'rejected', updated_at = datetime('now')
         WHERE property_id = ? AND id <> ? AND status = 'pending'`,
        [offer.property_id, offerId]
      );

      // 3. Update property status to 'under_offer'
      this.db.run(
        `UPDATE properties SET status = 'under_offer', updated_at = datetime('now') WHERE id = ?`,
        [offer.property_id]
      );

      // 4. Log in status_history
      this.db.run(
        `INSERT INTO status_history (id, property_id, old_status, new_status, changed_by, notes, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          randomUUID(),
          offer.property_id,
          'active',
          'under_offer',
          acceptedBy || null,
          notes || `Offer ${offerId} for amount ${offer.amount} accepted; other pending offers rejected.`
        ]
      );

      const acceptedOffer = this.findById(offerId)!;
      const updatedProperty = this.db.get<Property>(
        `SELECT * FROM properties WHERE id = ?`,
        [offer.property_id]
      )!;

      return {
        acceptedOffer,
        rejectedOffersCount: rejectResult.changes,
        property: updatedProperty
      };
    });
  }

  public rejectOffer(offerId: string): Offer {
    const offer = this.findById(offerId);
    if (!offer) {
      throw new Error(`Offer '${offerId}' not found`);
    }
    if (offer.status !== 'pending') {
      throw new Error(`Cannot reject offer with status '${offer.status}'`);
    }

    this.db.run(
      `UPDATE offers SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`,
      [offerId]
    );

    return this.findById(offerId)!;
  }
}
