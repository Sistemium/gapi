import * as mongoose from 'sistemium-mongo/lib/mongoose';
import makeActionDiscount from './transform/makeActionDiscount';

main().catch();

async function main() {

  await mongoose.connect();

  await makeActionDiscount();

}
