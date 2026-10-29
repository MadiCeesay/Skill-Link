import { success } from '../../utils/response.js';
export const mediaController = service => ({
  upload: async (req, res) => success(res, { media: await service.upload(req.auth.user, req.validatedParams.purpose, req.file) }, 201),
  access: async (req, res) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); return success(res, await service.access(req.validatedParams.id, req.auth.user)); },
});
