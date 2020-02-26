import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'ContractArticle',
  schema: {
    contractId: String,
    articleId: String,
    discount: Number,
    discountCategoryId: String,
    documentId: String,
    documentDate: Date,
  },
  indexes: [
    { contractId: 1, articleId: 1 },
  ],
  mergeBy: ['contractId', 'articleId'],
  tsType: 'timestamp',
}).model();
