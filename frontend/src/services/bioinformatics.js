import apiClient from './api';

export const getBioinformaticsAtlasAPI = async () => {
  const response = await apiClient.get('/bioinformatics/atlas');
  // The API client returns the envelope while some test/dev adapters return
  // the payload directly. Normalize both forms at the service boundary so the
  // page never tries to render `{ success, data }` as an atlas document.
  const payload = response?.data ?? response;
  return payload?.data ?? payload;
};

export default { getBioinformaticsAtlasAPI };
