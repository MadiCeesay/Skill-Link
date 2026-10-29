import { success } from '../../utils/response.js';
export const discoveryController = service => async (req, res) => { res.set('Cache-Control', 'no-store'); return success(res, await service.search(req.validatedQuery)); };
