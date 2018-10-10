import { EnvironmentSchema } from './schema';

/**
 * Environment: prod
 */
const env: EnvironmentSchema = {
  name: 'production',
  enableAnimations: true,
  ratesAPI: {
    btc: 'https://fcash.cash/api/rates',
    bch: 'https://fcash.cash/api/rates/bch'
  },
  activateScanner: true
};

export default env;
