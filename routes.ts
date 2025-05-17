import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { insertHotelSchema, insertReviewSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Hotel routes
  app.get('/api/hotels', async (req, res) => {
    try {
      const hotels = await storage.getHotelsWithReviews();
      res.json(hotels);
    } catch (error) {
      console.error("Error fetching hotels:", error);
      res.status(500).json({ message: "Failed to fetch hotels" });
    }
  });

  app.get('/api/hotels/:id', async (req, res) => {
    try {
      const hotelId = parseInt(req.params.id);
      if (isNaN(hotelId)) {
        return res.status(400).json({ message: "Invalid hotel ID" });
      }
      
      const hotel = await storage.getHotelWithReviews(hotelId);
      if (!hotel) {
        return res.status(404).json({ message: "Hotel not found" });
      }
      
      res.json(hotel);
    } catch (error) {
      console.error("Error fetching hotel:", error);
      res.status(500).json({ message: "Failed to fetch hotel" });
    }
  });

  app.post('/api/hotels', isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertHotelSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid hotel data", 
          errors: validation.error.errors 
        });
      }
      
      // Check if hotel already exists
      const existingHotel = await storage.getHotelByName(
        validation.data.name, 
        validation.data.location
      );
      
      if (existingHotel) {
        return res.json(existingHotel);
      }
      
      const hotel = await storage.createHotel(validation.data);
      res.status(201).json(hotel);
    } catch (error) {
      console.error("Error creating hotel:", error);
      res.status(500).json({ message: "Failed to create hotel" });
    }
  });

  // Review routes
  app.get('/api/reviews/top', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const reviews = await storage.getTopReviews(limit);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching top reviews:", error);
      res.status(500).json({ message: "Failed to fetch top reviews" });
    }
  });

  app.post('/api/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid review data", 
          errors: validation.error.errors 
        });
      }
      
      const userId = req.user.claims.sub;
      const review = await storage.createReview(validation.data, userId);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Destination routes
  app.get('/api/destinations/top', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const destinations = await storage.getTopDestinations(limit);
      res.json(destinations);
    } catch (error) {
      console.error("Error fetching top destinations:", error);
      res.status(500).json({ message: "Failed to fetch top destinations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
