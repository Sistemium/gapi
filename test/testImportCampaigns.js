import { expect, assert } from 'chai';
import lo from 'lodash';
import { readJsonFile } from '../src/lib/fs';

import { importVariant } from '../src/import/campaignsImport';

describe('Campaign import', function () {

  it('should convert r50 variants', async function () {

    const campaign = await readJsonFile('static/campaign.r50.json');

    assert(campaign.variants, 'Empty sample variants');

    const variant = importVariant(campaign.variants[0]);
    const { articles, articleIds } = variant;

    expect(articles.length).to.be.equal(articleIds.length);
    expect(variant).to.eql({});

  });

});
