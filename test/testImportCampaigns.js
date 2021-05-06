import { expect, assert } from 'chai';

import { readJsonFile } from '../src/lib/fs';
import { importVariant, importCampaign, hasAnyDiscount } from '../src/import/campaignsImport';
import lo from 'lodash';

describe('Campaign import', function () {

  it('should convert r50 variants', async function () {

    const campaign = await readJsonFile('static/campaign.r50.json');

    assert(campaign.variants, 'Empty sample variants');

    const variant = importVariant(campaign.variants[0]);
    const { articles, articleIds } = variant;

    expect(articles.length).to.be.equal(articleIds.length);
    // expect(variant).to.eql({});

  });

  it('should convert bs variants', async function () {

    const campaign = await readJsonFile('static/campaign.bs.json');

    assert(campaign.variants, 'Empty sample variants');

    const variant = importVariant(campaign.variants[0]);
    const { articles, articleIds } = variant;

    expect(articles[0].articleIds.length).to.be.equal(articleIds.length);
    // expect(variant).to.eql({});

  });

  it('should filter empty variants', async function () {
    const campaign = await readJsonFile('static/campaign.with.error.r50.json');
    const imported = importCampaign(campaign);
    const hasDiscount = hasAnyDiscount(imported);
    assert(hasDiscount, 'should have a discount');
    expect(imported.variants.length).equals(campaign.variants.length - 1);
    // expect(imported).to.eql({});
  });

});
