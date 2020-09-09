import SalesTeam from '../models/SalesTeam';

export async function campaignGroups() {

  const salesTeams = await SalesTeam.find();

  if (!salesTeams.length) {
    return [{ value: null, label: null }];
  }

  return salesTeams.map(t => ({
    label: t.name,
    value: t.id,
    order: t.ord,
  }));

}
