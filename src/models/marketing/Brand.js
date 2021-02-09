import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Brand',
  schema: {
    name: String,
    code: Number,
  },
  tsType: 'timestamp',
}).model();
