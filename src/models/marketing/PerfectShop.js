import ModelSchema from 'sistemium-mongo/lib/schema';

const BLOCK = {
  _id: false,
  ord: Number,
  name: String, // Vodka
  commentText: String,
  assortmentIds: [String],
};

const LEVEL = {
  _id: false,
  name: String, // Bronze
  prize: Number,
  blockRequirements: [{
    _id: false,
    name: String,
    shipmentCost: Number,
  }],
  requirements: [{
    _id: false,
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
