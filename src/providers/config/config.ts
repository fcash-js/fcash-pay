import { Injectable } from '@angular/core';
import { Logger } from '../../providers/logger/logger';
import { PersistenceProvider } from '../persistence/persistence';

import * as _ from 'lodash';

export interface Config {
  limits: {
    totalFcashApp: number;
    mPlusN: number;
  };

  wallet: {
    useLegacyAddress: boolean;
    requiredFcashApp: number;
    totalFcashApp: number;
    spendUnconfirmed: boolean;
    reconnectDelay: number;
    idleDurationMin: number;
    settings: {
      unitName: string;
      unitToSatoshi: number;
      unitDecimals: number;
      unitCode: string;
      alternativeName: string;
      alternativeIsoCode: string;
      defaultLanguage: string;
      feeLevel: string;
    };
  };

  fws: {
    url: string;
  };

  download: {
    fcash: {
      url: string;
    };
    copay: {
      url: string;
    };
  };

  rateApp: {
    fcash: {
      ios: string;
      android: string;
      wp: string;
    };
    copay: {
      ios: string;
      android: string;
      wp: string;
    };
  };

  lock: {
    method: any;
    value: any;
    bannedUntil: any;
  };

  recentTransactions: {
    enabled: boolean;
  };

  persistentLogsEnabled: boolean;

  showIntegration: {
    coinbase: boolean;
    glidera: boolean;
    debitcard: boolean;
    amazon: boolean;
    mercadolibre: boolean;
    shapeshift: boolean;
  };

  rates: {
    url: string;
  };

  release: {
    url: string;
  };

  pushNotificationsEnabled: boolean;

  confirmedTxsNotifications: {
    enabled: boolean;
  };

  emailNotifications: {
    enabled: boolean;
    email: string;
  };

  emailFor?: any;
  fwsFor?: any;
  aliasFor?: any;
  colorFor?: any;
  touchIdFor?: any;

  log: {
    weight: number;
  };

  blockExplorerUrl: {
    btc: string;
    bch: string;
  };
}

const configDefault: Config = {
  // wallet limits
  limits: {
    totalFcashApp: 6,
    mPlusN: 100
  },

  // wallet default config
  wallet: {
    useLegacyAddress: false,
    requiredFcashApp: 2,
    totalFcashApp: 3,
    spendUnconfirmed: false,
    reconnectDelay: 5000,
    idleDurationMin: 4,
    settings: {
      unitName: 'BTC',
      unitToSatoshi: 100000000,
      unitDecimals: 8,
      unitCode: 'btc',
      alternativeName: 'US Dollar',
      alternativeIsoCode: 'USD',
      defaultLanguage: '',
      feeLevel: 'normal'
    }
  },

  // Fcash wallet service URL
  fws: {
    url: 'https://fws.fcash.cash/fws/api'
  },

  download: {
    fcash: {
      url: 'https://www.fcash.cash/#download'
    }
  },

  rateApp: {
    fcash: {
      ios: 'https://itunes.apple.com/app/cash.fcash.wallet/id951330296',
      android: 'https://play.google.com/store/apps/details?id=cash.fcash.wallet',
      wp: ''
    }
  },

  lock: {
    method: null,
    value: null,
    bannedUntil: null
  },

  recentTransactions: {
    enabled: true
  },

  persistentLogsEnabled: true,

  // External services
  showIntegration: {
    coinbase: true,
    glidera: true,
    debitcard: true,
    amazon: true,
    mercadolibre: true,
    shapeshift: true
  },

  rates: {
    url: 'https://insight.fcash.cash:443/api/rates'
  },

  release: {
    url: 'https://api.github.com/repos/fcash-project/fcash-pay/releases/latest'
  },

  pushNotificationsEnabled: true,

  confirmedTxsNotifications: {
    enabled: true
  },

  emailNotifications: {
    enabled: false,
    email: ''
  },

  log: {
    weight: 3
  },

  blockExplorerUrl: {
    btc: 'insight.fcash.cash',
    bch: 'bch-insight.fcash.cash/#'
  }
};

@Injectable()
export class ConfigProvider {
  private configCache: Config;

  constructor(
    private logger: Logger,
    private persistence: PersistenceProvider
  ) {
    this.logger.debug('ConfigProvider initialized');
  }

  public load() {
    return new Promise((resolve, reject) => {
      this.persistence
        .getConfig()
        .then((config: Config) => {
          if (!_.isEmpty(config)) {
            this.configCache = _.clone(config);
            this.backwardCompatibility();
          } else {
            this.configCache = _.clone(configDefault);
          }
          this.logImportantConfig(this.configCache);
          resolve();
        })
        .catch(err => {
          this.logger.error('Error Loading Config');
          reject(err);
        });
    });
  }

  private logImportantConfig(config: Config): void {
    let spendUnconfirmed = config.wallet.spendUnconfirmed;
    let useLegacyAddress = config.wallet.useLegacyAddress;
    let persistentLogsEnabled = config.persistentLogsEnabled;
    let lockMethod = config.lock.method;

    this.logger.debug(
      'Config | spendUnconfirmed: ' +
        spendUnconfirmed +
        ' - useLegacyAddress: ' +
        useLegacyAddress +
        ' - persistentLogsEnabled: ' +
        persistentLogsEnabled +
        ' - lockMethod: ' +
        lockMethod
    );
  }

  /**
   * @param newOpts object or string (JSON)
   */
  public set(newOpts) {
    let config = _.cloneDeep(configDefault);

    if (_.isString(newOpts)) {
      newOpts = JSON.parse(newOpts);
    }
    _.merge(config, this.configCache, newOpts);
    this.configCache = config;
    this.persistence.storeConfig(this.configCache).then(() => {
      this.logger.info('Config saved');
    });
  }

  public get(): Config {
    return this.configCache;
  }

  public getDefaults(): Config {
    return configDefault;
  }

  private backwardCompatibility() {
    // these ifs are to avoid migration problems
    if (this.configCache.fws) {
      this.configCache.fws = configDefault.fws;
    }
    if (!this.configCache.wallet) {
      this.configCache.wallet = configDefault.wallet;
    }
    if (!this.configCache.wallet.settings.unitCode) {
      this.configCache.wallet.settings.unitCode =
        configDefault.wallet.settings.unitCode;
    }
    if (!this.configCache.showIntegration) {
      this.configCache.showIntegration = configDefault.showIntegration;
    }
    if (!this.configCache.recentTransactions) {
      this.configCache.recentTransactions = configDefault.recentTransactions;
    }
    if (!this.configCache.persistentLogsEnabled) {
      this.configCache.persistentLogsEnabled =
        configDefault.persistentLogsEnabled;
    }
    if (!this.configCache.pushNotificationsEnabled) {
      this.configCache.pushNotificationsEnabled =
        configDefault.pushNotificationsEnabled;
    }

    if (this.configCache.wallet.settings.unitCode == 'bit') {
      // Convert to BTC. Bits will be disabled
      this.configCache.wallet.settings.unitName =
        configDefault.wallet.settings.unitName;
      this.configCache.wallet.settings.unitToSatoshi =
        configDefault.wallet.settings.unitToSatoshi;
      this.configCache.wallet.settings.unitDecimals =
        configDefault.wallet.settings.unitDecimals;
      this.configCache.wallet.settings.unitCode =
        configDefault.wallet.settings.unitCode;
    }
  }
}
