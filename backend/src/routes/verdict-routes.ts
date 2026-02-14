/**
 * Verdict Routes
 * HTTP routes for verdict retrieval (fallback endpoint)
 */

import { Router } from 'express';
import { VerdictHttpController } from '../controllers/verdict-http.controller';

const router = Router();

/**
 * GET /:roomId/verdict
 * Retrieve cached verdict result for a room
 */
router.get(
    '/:roomId/verdict',
    VerdictHttpController.getVerdict.bind(VerdictHttpController)
);

export default router;
