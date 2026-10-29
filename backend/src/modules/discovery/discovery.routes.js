import { Router } from 'express';
import { query } from '../../utils/validation.js';
import { discoveryQuery } from './discovery.validator.js';
import { discoveryController } from './discovery.controller.js';
export function discoveryRoutes(service, config) {
  const router = Router();
  router.get('/workers', query(discoveryQuery(config.DISCOVERY_MAX_RADIUS_KM ?? 200, config.DISCOVERY_DEFAULT_RADIUS_KM ?? 25)), discoveryController(service));
  return router;
}
