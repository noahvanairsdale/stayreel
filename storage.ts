import { hotels, reviews, users, type Hotel, type InsertHotel, type Review, type InsertReview, type User, type UpsertUser, type HotelWithReviews, type Destination } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Hotel operations
  getHotels(): Promise<Hotel[]>;
  getHotel(id: number): Promise<Hotel | undefined>;
  getHotelByName(name: string, location: string): Promise<Hotel | undefined>;
  createHotel(hotel: InsertHotel): Promise<Hotel>;
  getHotelsWithReviews(): Promise<HotelWithReviews[]>;
  getHotelWithReviews(id: number): Promise<HotelWithReviews | undefined>;
  
  // Review operations
  getReviews(): Promise<Review[]>;
  getReviewsByHotel(hotelId: number): Promise<(Review & { user: User })[]>;
  getTopReviews(limit?: number): Promise<(Review & { user: User, hotel: Hotel })[]>;
  createReview(review: InsertReview, userId: string): Promise<Review>;
  
  // Destination operations
  getTopDestinations(limit?: number): Promise<Destination[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private hotels: Map<number, Hotel>;
  private reviews: Map<number, Review>;
  private hotelIdCounter: number;
  private reviewIdCounter: number;

  constructor() {
    this.users = new Map();
    this.hotels = new Map();
    this.reviews = new Map();
    this.hotelIdCounter = 1;
    this.reviewIdCounter = 1;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      ...userData,
      createdAt: this.users.has(userData.id) 
        ? this.users.get(userData.id)!.createdAt 
        : new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(userData.id, user);
    return user;
  }

  // Hotel operations
  async getHotels(): Promise<Hotel[]> {
    return Array.from(this.hotels.values());
  }

  async getHotel(id: number): Promise<Hotel | undefined> {
    return this.hotels.get(id);
  }

  async getHotelByName(name: string, location: string): Promise<Hotel | undefined> {
    return Array.from(this.hotels.values()).find(
      hotel => hotel.name.toLowerCase() === name.toLowerCase() && 
               hotel.location.toLowerCase() === location.toLowerCase()
    );
  }

  async createHotel(hotelData: InsertHotel): Promise<Hotel> {
    const id = this.hotelIdCounter++;
    const hotel: Hotel = {
      ...hotelData,
      id,
      createdAt: new Date(),
    };
    
    this.hotels.set(id, hotel);
    return hotel;
  }

  async getHotelsWithReviews(): Promise<HotelWithReviews[]> {
    const hotels = await this.getHotels();
    const result: HotelWithReviews[] = [];
    
    for (const hotel of hotels) {
      const hotelReviews = await this.getReviewsByHotel(hotel.id);
      
      const averageRating = hotelReviews.length > 0
        ? hotelReviews.reduce((sum, review) => sum + review.rating, 0) / hotelReviews.length
        : 0;
      
      result.push({
        ...hotel,
        reviews: hotelReviews,
        averageRating,
        reviewCount: hotelReviews.length
      });
    }
    
    return result;
  }

  async getHotelWithReviews(id: number): Promise<HotelWithReviews | undefined> {
    const hotel = await this.getHotel(id);
    if (!hotel) return undefined;
    
    const hotelReviews = await this.getReviewsByHotel(id);
    
    const averageRating = hotelReviews.length > 0
      ? hotelReviews.reduce((sum, review) => sum + review.rating, 0) / hotelReviews.length
      : 0;
    
    return {
      ...hotel,
      reviews: hotelReviews,
      averageRating,
      reviewCount: hotelReviews.length
    };
  }

  // Review operations
  async getReviews(): Promise<Review[]> {
    return Array.from(this.reviews.values());
  }

  async getReviewsByHotel(hotelId: number): Promise<(Review & { user: User })[]> {
    const reviews = Array.from(this.reviews.values())
      .filter(review => review.hotelId === hotelId)
      .sort((a, b) => b.rating - a.rating);
    
    return reviews.map(review => {
      const user = this.users.get(review.userId);
      if (!user) throw new Error(`User ${review.userId} not found`);
      return { ...review, user };
    });
  }

  async getTopReviews(limit: number = 10): Promise<(Review & { user: User, hotel: Hotel })[]> {
    const reviews = Array.from(this.reviews.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
    
    return reviews.map(review => {
      const user = this.users.get(review.userId);
      if (!user) throw new Error(`User ${review.userId} not found`);
      
      const hotel = this.hotels.get(review.hotelId);
      if (!hotel) throw new Error(`Hotel ${review.hotelId} not found`);
      
      return { ...review, user, hotel };
    });
  }

  async createReview(reviewData: InsertReview, userId: string): Promise<Review> {
    const id = this.reviewIdCounter++;
    const review: Review = {
      ...reviewData,
      id,
      userId,
      createdAt: new Date(),
      likes: 0,
      comments: 0
    };
    
    this.reviews.set(id, review);
    return review;
  }

  // Destination operations
  async getTopDestinations(limit: number = 10): Promise<Destination[]> {
    // Group hotels by location
    const hotelsByLocation = new Map<string, Hotel[]>();
    
    for (const hotel of this.hotels.values()) {
      const location = hotel.location;
      if (!hotelsByLocation.has(location)) {
        hotelsByLocation.set(location, []);
      }
      hotelsByLocation.get(location)!.push(hotel);
    }
    
    // Calculate review counts and average ratings for each location
    const destinations: Destination[] = [];
    
    for (const [location, locationHotels] of hotelsByLocation.entries()) {
      let totalReviews = 0;
      const hotelsWithReviews: HotelWithReviews[] = [];
      
      for (const hotel of locationHotels) {
        const hotelReviews = await this.getReviewsByHotel(hotel.id);
        totalReviews += hotelReviews.length;
        
        const averageRating = hotelReviews.length > 0
          ? hotelReviews.reduce((sum, review) => sum + review.rating, 0) / hotelReviews.length
          : 0;
        
        hotelsWithReviews.push({
          ...hotel,
          reviews: hotelReviews,
          averageRating,
          reviewCount: hotelReviews.length
        });
      }
      
      // Skip locations with no reviews
      if (totalReviews === 0) continue;
      
      // Sort hotels by average rating
      const topHotels = hotelsWithReviews
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 3);
      
      // Default image URL based on location
      // In a real application, we would have proper images for each destination
      const imageUrl = `https://source.unsplash.com/random/400x250/?${encodeURIComponent(location)}`;
      
      destinations.push({
        name: location,
        reviewCount: totalReviews,
        imageUrl,
        topHotels
      });
    }
    
    // Sort by review count (most reviewed destinations first)
    return destinations
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
