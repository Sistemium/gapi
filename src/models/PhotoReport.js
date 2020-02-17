import ModelSchema from 'sistemium-mongo/lib/schema';

export default new ModelSchema({
  collection: 'Article',
  schema: {
    href: String,

    thumbnailHref: String,
    smallSrc: String,
    thumbnailSrc: String,
    src: Object,
    deviceCts: String,

    campaignId: String,
    outletId: String,
    authorId: String,
    locationId: String,

    picturesInfo: Array,

  },
  tsType: 'timestamp',
}).model();
