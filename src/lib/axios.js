import axios from 'axios';

const { ORG, ACCESS_TOKEN, API_URL } = process.env;

if (!ORG || !ACCESS_TOKEN || !API_URL) {
  throw new Error('Either ACCESS_TOKEN or ORG or API_URL is not defined');
}

const instance = axios.create({

  baseURL: `${process.env.API_URL}/${ORG}/`,
  headers: { authorization: ACCESS_TOKEN },
  timeout: 10000,

});

instance.interceptors.response.use(({ data }) => data);

export default instance;
