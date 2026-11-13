import { SQLiteDatabase, getDatabase } from '../database/db.ts';
import type { User, UserRole, Property, PropertyStatus, ListingType, Offer, RentalApplication } from '../database/db.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { PropertyRepository } from '../repositories/propertyRepository.ts';
import type { PropertyFilters, CreatePropertyInput, UpdatePropertyInput } from '../repositories/propertyRepository.ts';
import { OfferRepository } from '../repositories/offerRepository.ts';
import { RentalRepository } from '../repositories/rentalRepository.ts';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message = 'Authentication required to perform this action') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export class SessionService {
  private db: SQLiteDatabase;
  private userRepo: UserRepository;
  private propertyRepo: PropertyRepository;
  private offerRepo: OfferRepository;
  private rentalRepo: RentalRepository;
  private currentUser: User | null = null;

  constructor(db?: SQLiteDatabase) {
    this.db = db || getDatabase();
    this.userRepo = new UserRepository(this.db);
    this.propertyRepo = new PropertyRepository(this.db);
    this.offerRepo = new OfferRepository(this.db);
    this.rentalRepo = new RentalRepository(this.db);
  }

  // ==========================================
  // Session Management (Login / Logout / State)
  // ==========================================

  public login(identifier: string): User {
    if (!identifier || identifier.trim().length === 0) {
      throw new AuthenticationError('Identifier (email, username or ID) is required to login');
    }

    const trimmed = identifier.trim();

    // Try finding by email
    let user = this.userRepo.findByEmail(trimmed);

    // If not found, try username
    if (!user) {
      user = this.userRepo.findByUsername(trimmed);
    }

    // If still not found, try by ID
    if (!user) {
      user = this.userRepo.findById(trimmed);
    }

    if (!user) {
      throw new AuthenticationError(`User '${identifier}' not found`);
    }

    this.currentUser = user;
    return user;
  }

  public logout(): void {
    this.currentUser = null;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public requireAuth(): User {
    if (!this.currentUser) {
      throw new AuthenticationRequiredError();
    }
    return this.currentUser;
  }

  public hasRole(roleOrRoles: UserRole | UserRole[]): boolean {
    if (!this.currentUser) return false;
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.includes(this.currentUser.role);
  }

  public requireRole(roleOrRoles: UserRole | UserRole[]): User {
    const user = this.requireAuth();
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    if (!roles.includes(user.role)) {
      throw new AccessDeniedError(
        `Action forbidden for role '${user.role}'. Required role(s): ${roles.join(', ')}`
      );
    }
    return user;
  }

  // ==========================================
  // Role-Based Catalog & Property Operations
  // ==========================================

  /**
   * Public active catalogue - accessible to everyone (Buyer, Seller, Agent, or non-logged in)
   */
  public getPublicCatalog(filters: PropertyFilters = {}): Property[] {
    return this.propertyRepo.findAll({
      ...filters,
      status: 'active'
    });
  }

  /**
   * Retrieve properties depending on current user role:
   * - Seller: their own properties (all statuses)
   * - Agent: their assigned properties (all statuses)
   * - Buyer: AccessDeniedError (buyers do not manage a property portfolio)
   */
  public getMyPortfolio(): Property[] {
    const user = this.requireAuth();

    if (user.role === 'seller') {
      return this.propertyRepo.findAll({ sellerId: user.id });
    }

    if (user.role === 'agent') {
      return this.propertyRepo.findAll({ agentId: user.id });
    }

    throw new AccessDeniedError(`Role '${user.role}' does not have a property portfolio`);
  }

  /**
   * Create an ad (Sale or Rent)
   * - Permitted ONLY to Seller
   * - Automatically binds seller_id to current user
   */
  public createProperty(input: Omit<CreatePropertyInput, 'seller_id'>): Property {
    const user = this.requireRole('seller');

    return this.propertyRepo.create({
      ...input,
      seller_id: user.id
    });
  }

  /**
   * Update a property:
   * - Seller: only their own property
   * - Agent: only their assigned property
   * - Buyer: AccessDeniedError
   */
  public updateProperty(
    propertyId: string,
    changes: UpdatePropertyInput,
    notes?: string
  ): Property {
    const user = this.requireRole(['seller', 'agent']);

    const prop = this.propertyRepo.findById(propertyId);
    if (!prop) {
      throw new Error(`Property '${propertyId}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only modify their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only modify properties assigned to them');
    }

    return this.propertyRepo.update(propertyId, changes, user.id, notes);
  }

  /**
   * Delete a property:
   * - Seller: only their own property (if not sold/rented)
   * - Agent & Buyer: forbidden
   */
  public deleteProperty(propertyId: string): void {
    const user = this.requireRole('seller');

    const prop = this.propertyRepo.findById(propertyId);
    if (!prop) {
      throw new Error(`Property '${propertyId}' not found`);
    }

    if (prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only delete their own properties');
    }

    this.propertyRepo.delete(propertyId);
  }

  /**
   * Moderate & activate a draft property:
   * - Agent: can review and activate an assigned draft
   * - Seller: can activate their own draft
   * - Buyer: forbidden
   */
  public activateProperty(propertyId: string, notes?: string): Property {
    const user = this.requireRole(['seller', 'agent']);

    const prop = this.propertyRepo.findById(propertyId);
    if (!prop) {
      throw new Error(`Property '${propertyId}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only activate their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only activate properties assigned to them');
    }

    return this.propertyRepo.updateStatus(propertyId, 'active', user.id, notes || 'Activated via session service');
  }

  // ==========================================
  // Role-Based Offer Operations (Buyer / Seller / Agent)
  // ==========================================

  /**
   * Submit an offer:
   * - Permitted ONLY to Buyer
   */
  public submitOffer(propertyId: string, amount: number): Offer {
    const user = this.requireRole('buyer');

    return this.offerRepo.create({
      property_id: propertyId,
      buyer_id: user.id,
      amount
    });
  }

  /**
   * Review offers on a property:
   * - Permitted ONLY to the owning Seller or assigned Agent
   */
  public getPropertyOffers(propertyId: string): Offer[] {
    const user = this.requireRole(['seller', 'agent']);

    const prop = this.propertyRepo.findById(propertyId);
    if (!prop) {
      throw new Error(`Property '${propertyId}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only view offers for their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only view offers for assigned properties');
    }

    return this.offerRepo.findByPropertyId(propertyId);
  }

  /**
   * Accept an offer on a property:
   * - Permitted ONLY to owning Seller or assigned Agent
   * - Automatically marks offer as accepted and rejects concurrent offers
   */
  public acceptOffer(offerId: string): { acceptedOffer: Offer; rejectedCount: number; property: Property } {
    const user = this.requireRole(['seller', 'agent']);

    const offer = this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error(`Offer '${offerId}' not found`);
    }

    const prop = this.propertyRepo.findById(offer.property_id);
    if (!prop) {
      throw new Error(`Property '${offer.property_id}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only accept offers on their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only accept offers on assigned properties');
    }

    return this.offerRepo.acceptOffer(offerId, user.id);
  }

  // ==========================================
  // Role-Based Rental Application Operations
  // ==========================================

  /**
   * Submit rental application:
   * - Permitted ONLY to Buyer
   */
  public submitRentalApplication(
    propertyId: string,
    moveInDate: string,
    notes?: string | null
  ): RentalApplication {
    const user = this.requireRole('buyer');

    return this.rentalRepo.create({
      property_id: propertyId,
      buyer_id: user.id,
      move_in_date: moveInDate,
      notes
    });
  }

  /**
   * Review rental applications on a property:
   * - Permitted ONLY to owning Seller or assigned Agent
   */
  public getPropertyRentalApplications(propertyId: string): RentalApplication[] {
    const user = this.requireRole(['seller', 'agent']);

    const prop = this.propertyRepo.findById(propertyId);
    if (!prop) {
      throw new Error(`Property '${propertyId}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only view rental applications for their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only view rental applications for assigned properties');
    }

    return this.rentalRepo.findByPropertyId(propertyId);
  }

  /**
   * Decide rental application (accept or reject):
   * - Permitted ONLY to owning Seller or assigned Agent
   */
  public decideRentalApplication(
    applicationId: string,
    decision: 'accepted' | 'rejected'
  ): RentalApplication {
    const user = this.requireRole(['seller', 'agent']);

    const app = this.rentalRepo.findById(applicationId);
    if (!app) {
      throw new Error(`Rental application '${applicationId}' not found`);
    }

    const prop = this.propertyRepo.findById(app.property_id);
    if (!prop) {
      throw new Error(`Property '${app.property_id}' not found`);
    }

    if (user.role === 'seller' && prop.seller_id !== user.id) {
      throw new AccessDeniedError('Seller can only decide rental applications for their own properties');
    }

    if (user.role === 'agent' && prop.agent_id !== user.id) {
      throw new AccessDeniedError('Agent can only decide rental applications for assigned properties');
    }

    if (decision === 'accepted') {
      return this.rentalRepo.acceptApplication(applicationId, user.id);
    } else {
      return this.rentalRepo.rejectApplication(applicationId);
    }
  }
}

