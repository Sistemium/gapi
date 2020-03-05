const $lt = new Date();

$lt.setUTCHours(0, 0, 0, 0);

printjson($lt);

main('ContractArticle');
main('PartnerArticle');
main('ContractPriceGroup');
main('PartnerPriceGroup');

function main(name) {

  const collection = db.getCollection(name);

  const updated = collection.updateMany(
    { discount: { $ne: 0 }, dateE: { $lt } },
    { $set: { discount: 0 }, $currentDate: { ts: { $type: 'timestamp' }} }
  );

  printjson(updated);

}
