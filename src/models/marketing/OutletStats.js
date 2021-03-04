import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'OutletStats',
  schema: {
    dateB: String,
    dateE: String,
    outletId: String,
    perfectShop: {
      // level: String,
      // nextLevel: String,
    },
    outletName: String,
    salesman: {
      id: String,
      name: String,
      salesGroupName: String,
    },
  },
  mergeBy: ['dateB', 'dateE', 'outletId'],
  tsType: 'timestamp',
}).model();
