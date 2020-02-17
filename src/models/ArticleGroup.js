import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'ArticleGroup',
  schema: {
    name: String,
    code: String,
    articleGroupId: String,
  },
  tsType: 'timestamp',
}).model();
