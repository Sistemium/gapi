import ModelSchema from 'sistemium-mongo/lib/schema';

const BLOCK = {
  ord: Number,
  name: String, // Vodka
  commentText: String,
  assortmentIds: [String],
};

const LEVEL = {
  name: String, // Bronze
  prize: Number,
  blockRequirements: [{
    name: String,
    shipmentCost: Number,
  }],
  requirements: [{
    assortmentId: String,
    countryCnt: Number,
    brandCnt: Number,
    skuCnt: Number,
    pieceCnt: Number,
    litreCnt: Number,
    facingCnt: Number,
  }],
};

export default new ModelSchema({
  collection: 'PerfectShop',
  schema: {
    dateB: String,
    dateE: String,
    blocks: [BLOCK],
    levels: [LEVEL],
  },
  tsType: 'timestamp',
}).model();
