/**
 * Room Routes
 * Defines HTTP routes for room management
 *
 * ARCHITECTURE: Route definition layer
 * - Defines URL paths and HTTP methods
 * - Maps routes to controller methods
 * - Does NOT contain logic
 */

import { Router } from 'express';
import { RoomController } from '../controllers/room-controller';

const router = Router();

/**
 * Create room endpoint
 * POST /room/create
 */
router.post('/create', RoomController.createRoom.bind(RoomController));

export default router;
