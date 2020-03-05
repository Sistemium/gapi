const mongo = db.getMongo();
const targetDb = mongo.getDB('r50Client');
const sourceDB = mongo.getDB('r50');

const discountCollection = sourceDB.getCollection('Discount');

main('ContractArticle');
main('PartnerArticle');
main('ContractPriceGroup');
main('PartnerPriceGroup');


function main(name) {

  printjson(name);
  const collection = targetDb.getCollection(name);

  const cursor = collection.aggregate([
    { $match: { discount: { $ne: 0 }, dateE: { $exists: false } } },
    {
      $group: {
        _id: '$documentId',
        cnt: { $sum: 1 },
      }
    },
  ]);

  if (!cursor.hasNext()) {
    printjson('empty');
    return;
  }

  while (cursor.hasNext()) {

    const { _id: documentId } = cursor.next();

    const discount = discountCollection.findOne({ _id: documentId });

    if (!discount) {
      printjson(`not found ${documentId}`);
      continue;
    }

    collection.updateMany({ documentId }, { $set: { dateE: discount.date = null } });

  }

  printjson('ok');

}
