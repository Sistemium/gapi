import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Article',
  schema: {
    name: String,
    code: String,
    articleGroupId: String,
    packageRel: Number,
  },
  tsType: 'timestamp',
}).model();
