import { Injectable } from '@angular/core';

import { Logger } from '../../providers/logger/logger';

import * as FWC from 'fcash-wallet-client';

@Injectable()
export class FwcProvider {
  public buildTx = FWC.buildTx;
  public parseSecret = FWC.parseSecret;
  public Client = FWC;
  constructor(private logger: Logger) {
    this.logger.debug('FwcProvider initialized');
  }
  public getFcash() {
    return FWC.Fcash;
  }

  public getFcashCash() {
    return FWC.FcashCash;
  }

  public getErrors() {
    return FWC.errors;
  }

  public getSJCL() {
    return FWC.sjcl;
  }

  public getUtils() {
    return FWC.Utils;
  }

  public getClient(walletData?, opts?) {
    opts = opts || {};

    // note opts use `fwsurl` all lowercase;
    let fwc = new FWC({
      baseUrl: opts.fwsurl || 'https://fws.fcash.cash/fws/api',
      verbose: opts.verbose,
      timeout: 100000,
      transports: ['polling']
    });
    if (walletData) fwc.import(walletData, opts);
    return fwc;
  }
}
