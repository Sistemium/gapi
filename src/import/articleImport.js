import lo from 'lodash';
import log from 'sistemium-telegram/services/log';

// import Article from '../models/Article';
import ArticleGroup from '../models/ArticleGroup';

const { debug } = log('import:article');

export default async function (model) {

  const raw = await model.find({
    isGroup: true,
  });

  const data = lo.filter(raw.map(importArticleGroup));

  debug('groups:source', raw.length);

  const merged = await ArticleGroup.mergeIfChanged(data);

  debug('groups:merged', merged.length);

  // await importOld();

}

function importArticleGroup(rawArticle) {
  const {
    _id: id,
    parentId: articleGroupId,
  } = rawArticle.toObject();
  return { id, articleGroupId, ...lo.pick(rawArticle.toObject(), ['name', 'code']) };
}
