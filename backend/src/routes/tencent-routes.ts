import { Router } from 'express';
import { TencentController } from './../controllers/tencent-controller';

const router = Router();

/**
 * Get STS token endpoint
 * GET /tencent/credentials
 */
router.get(
    '/credentials',
    TencentController.getSTSToken.bind(TencentController)
);

export default router;
