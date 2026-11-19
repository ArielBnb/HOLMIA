import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { Enquiry, Property } from '../database/db.ts';
import { randomUUID } from 'node:crypto';

// Buyer enquiries on listings. Same rules as public.enquiries in Supabase
// (supabase/migrations/20261122120000_enquiries.sql). Access control (who may
// read or reply) is enforced by SessionService.
export const ENQUIRY_MAX = 2000;

export interface ReceivedEnquiry extends Enquiry {
  property_title: string;
  buyer_name: string;
}

const cleanText = (value: string, label: string): string => {
  const text = (value ?? '').trim();
  if (text.length === 0) throw new Error(`${label} cannot be empty`);
  if (text.length > ENQUIRY_MAX) throw new Error(`${label} must be at most ${ENQUIRY_MAX} characters`);
  return text;
};

export class EnquiryRepository {
  private db: SQLiteDatabase;

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
  }

  public create(input: { property_id: string; buyer_id: string; message: string }): Enquiry {
    const message = cleanText(input.message, 'Message');
    const buyer = this.db.get<{ role: string }>(`SELECT role FROM users WHERE id = ?`, [input.buyer_id]);
    if (!buyer || buyer.role !== 'buyer') throw new Error('Only buyers can send enquiries');
    const property = this.db.get<Property>(`SELECT * FROM properties WHERE id = ?`, [input.property_id]);
    if (!property) throw new Error(`Property '${input.property_id}' not found`);
    if (property.status === 'draft') throw new Error('Enquiries can only be sent about published listings');

    const id = randomUUID();
    this.db.run(
      `INSERT INTO enquiries (id, property_id, buyer_id, message, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, input.property_id, input.buyer_id, message]
    );
    return this.findById(id)!;
  }

  public findById(id: string): Enquiry | null {
    return this.db.get<Enquiry>(`SELECT * FROM enquiries WHERE id = ?`, [id]) || null;
  }

  // Enquiries on the given properties, pending first.
  public findForProperties(propertyIds: string[]): ReceivedEnquiry[] {
    if (propertyIds.length === 0) return [];
    const marks = propertyIds.map(() => '?').join(', ');
    return this.db.query<ReceivedEnquiry>(
      `SELECT e.*, p.title AS property_title, u.full_name AS buyer_name
       FROM enquiries e JOIN properties p ON p.id = e.property_id JOIN users u ON u.id = e.buyer_id
       WHERE e.property_id IN (${marks})
       ORDER BY (e.reply IS NULL) DESC, e.created_at DESC, e.rowid DESC`,
      propertyIds
    );
  }

  public findByBuyer(buyerId: string): Enquiry[] {
    return this.db.query<Enquiry>(
      `SELECT * FROM enquiries WHERE buyer_id = ? ORDER BY created_at DESC, rowid DESC`,
      [buyerId]
    );
  }

  // Stores the reply (or a corrected reply); the enquiry becomes "handled".
  public reply(id: string, reply: string, repliedBy: string): Enquiry {
    if (!this.findById(id)) throw new Error(`Enquiry '${id}' not found`);
    const text = cleanText(reply, 'Reply');
    this.db.run(
      `UPDATE enquiries SET reply = ?, replied_by = ?, replied_at = datetime('now') WHERE id = ?`,
      [text, repliedBy, id]
    );
    return this.findById(id)!;
  }
}
