import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'PartnerArticle',
  schema: {
    partnerId: String,
    articleId: String,
    discount: Number,
    dateE: Date,
    discountCategoryId: String,
    documentId: String,
    documentDate: Date,
  },
  indexes: [
    { partnerId: 1, articleId: 1 },
  ],
  mergeBy: ['partnerId', 'articleId'],
  tsType: 'timestamp',
}).model();
