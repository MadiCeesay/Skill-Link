import { ApiError } from '../../utils/ApiError.js';
export class UnavailableMediaProvider {
  name = 'disabled';
  upload() { throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured'); }
  access() { throw new ApiError(503, 'MEDIA_UNAVAILABLE', 'Media storage is not configured'); }
}
