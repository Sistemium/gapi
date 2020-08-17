import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'UserSubscription',
  schema: {
    authId: String,
    name: String,
    email: String,
    campaignsFile: {
      isEnabled: Boolean,
      filter: {
        groupCode: String,
      },
    },
  },
  tsType: 'timestamp',
}).model();
