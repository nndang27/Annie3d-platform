import api from './api';
import canvas from './canvas';
import chrome from './chrome';
import common from './common';
import contracts from './contracts';
import desktop from './desktop';
import editor from './editor';
import sim from './sim';
import site from './site';

/**
 * English, the source text. One file per area; keys start with the area's prefixes, so two
 * files cannot define the same key (checked by i18n.test.ts).
 */
export const NAMESPACES = { common, contracts, chrome, canvas, editor, sim, api, desktop, site };

const en = {
  ...common,
  ...contracts,
  ...chrome,
  ...canvas,
  ...editor,
  ...sim,
  ...api,
  ...desktop,
  ...site,
};
export default en;
