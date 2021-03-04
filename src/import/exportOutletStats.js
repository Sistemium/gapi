import log from 'sistemium-debug';
import lo from 'lodash';
import * as mongoose from 'sistemium-mongo/lib/mongoose';
import * as dates from 'sistemium-dates';

import exporter from '../lib/exporter';

import * as sql from './sql/exportOutletStats';
import OutletStats from '../models/marketing/OutletStats';

const { debug, error } = log('export:outletStats');

// main().catch(error);

export default async function () {

  await mongoose.connect();
  const monthId = dates.currentMonth();

  try {
    await doExport(monthId);
  } catch (e) {
    error(e);
  }

  await mongoose.disconnect();

}


async function doExport(monthId) {
  const matchOutletStats = {
    dateB: dates.monthStart(monthId),
    dateE: dates.monthEnd(monthId),
    'salesman.id': { $ne: null },
    outletId: { $ne: null },
    perfectShop: { $ne: null },
  };

  debug('filter', matchOutletStats);

  const exportData = await OutletStats.aggregate([{ $match: matchOutletStats }]);

  debug('exportData', exportData.length);

  await exportToAnywhere(lo.filter(exportData, 'salesman'));

}

async function exportToAnywhere(data) {

  if (!data.length) {
    return;
  }

  const values = data.map(s => [
    s.dateB,
    s.dateE,
    s.outletId,
    s.salesman.id,
    JSON.stringify({ perfectShop: s.perfectShop }),
    s.id,
  ]);

  await exporter({
    ...sql,
    values,
  });

}
