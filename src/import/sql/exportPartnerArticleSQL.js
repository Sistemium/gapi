export const declare = `declare local temporary table #discount (

    partnerId STRING,
    articleId STRING,
    discount MONEY,
    type STRING,

    primary key(partnerId, articleId)

  )`;

export const insert = `insert into #discount (
    partnerId,
    articleId,
    discount,
    type,
  ) values (?, ?, ?, ?)`;

export const merge = `merge into bs.PartnerArticle as d using with auto name (
    select
      c.id as partner,
      a.id as article,
      d.discount,
      d.type,
      0 as isDeleted
    from #discount d
      join bs.Partner c on c.xid = d.partnerId
      join bs.ArticleTable a on a.xid = d.articleId
  ) as t on t.partner = d.partner and t.article = d.article
  when not matched then insert
  when matched and (
      d.discount <> t.discount or
      d.type <> t.type or
      d.partner <> t.partner or
      d.article <> t.article
    ) then update
  `;
