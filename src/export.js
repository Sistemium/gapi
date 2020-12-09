import log from 'sistemium-debug';
import exportArchive from './import/exportArchive';

const { error } = log('export');

exportArchive()
  .catch(error);
