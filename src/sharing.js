import log from 'sistemium-debug';
import campaignsSharing from './import/campaignsSharing';

const { error } = log('sharing');

campaignsSharing()
  .catch(error);
