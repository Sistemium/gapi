import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'ActionDiscount',
  schema: {
    name: String,
    discount: Number,
    discountComp: Number,
    discountOwn: Number,
  },
  tsType: 'timestamp',
}).model();
