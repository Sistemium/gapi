import log from 'sistemium-telegram/services/log';
import campaignsSharing from './import/campaignsSharing';

const { error } = log('sharing');

campaignsSharing()
  .catch(error);
