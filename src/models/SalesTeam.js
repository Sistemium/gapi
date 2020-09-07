import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'SalesTeam',
  schema: {
    name: String,
    ord: Number,
    cls: String,
  },
  tsType: 'timestamp',
}).model();
