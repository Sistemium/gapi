import Router from 'koa-router';
import KoaApi from 'sistemium-mongo/lib/koa';
import { defaultRoutes } from 'sistemium-mongo/lib/api';
import auth from 'sistemium-auth/lib/middleware';

import models from '../models';
import * as ActionExport from '../controllers/ActionExport';

const api = new Router()
  .prefix('/api')
  .use(auth({ requiredRole: false }));

defaultRoutes(api, [...models]);

api.get('/ActionExport', ActionExport.getHandler);

export default new KoaApi({ api });
