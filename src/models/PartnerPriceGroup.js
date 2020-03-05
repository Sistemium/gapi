import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'PartnerPriceGroup',
  schema: {
    partnerId: String,
    priceGroupId: String,
    discount: Number,
    dateE: Date,
    discountCategoryId: String,
    documentId: String,
    documentDate: Date,
  },
  indexes: [
    { partnerId: 1, priceGroupId: 1 },
    { documentId: 1 },
  ],
  mergeBy: ['partnerId', 'priceGroupId'],
  tsType: 'timestamp',
}).model();
