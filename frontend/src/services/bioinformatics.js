import apiClient from './api';

export const getBioinformaticsAtlasAPI = async () => {
  const response = await apiClient.get('/bioinformatics/atlas');
  return response.data;
};

export default { getBioinformaticsAtlasAPI };
