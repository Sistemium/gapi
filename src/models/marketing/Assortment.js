import ModelSchema from '../../../../sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Assortment',
  schema: {
    name: String,
    code: String,
    articleIds: [String],
  },
  tsType: 'timestamp',
}).model();
