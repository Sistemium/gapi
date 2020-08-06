import axios from 'axios';

const { ORG, ACCESS_TOKEN } = process.env;

if (!ORG || !ACCESS_TOKEN) {
  throw new Error('ACCESS_TOKEN or ORG not defined');
}

const instance = axios.create({

  baseURL: `${process.env.API_URL}/${ORG}/`,
  headers: { authorization: ACCESS_TOKEN },
  timeout: 10000,

});

instance.interceptors.response.use(({ data }) => data);

export default instance;
