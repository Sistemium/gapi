import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'ContractPriceGroup',
  schema: {
    contractId: String,
    priceGroupId: String,
    discount: Number,
    discountTypeId: String,
    documentId: String,
    documentDate: Date,
  },
  indexes: [
    { contractId: 1, priceGroupId: 1 },
  ],
  mergeBy: ['contractId', 'priceGroupId'],
  tsType: 'timestamp',
}).model();
