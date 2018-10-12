import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Events, NavController, NavParams } from 'ionic-angular';
import * as lodash from 'lodash';
import { Logger } from '../../../../../providers/logger/logger';

// Providers
import { FwcErrorProvider } from '../../../../../providers/fwc-error/fwc-error';
import { FwcProvider } from '../../../../../providers/fwc/fwc';
import { ExternalLinkProvider } from '../../../../../providers/external-link/external-link';
import { OnGoingProcessProvider } from '../../../../../providers/on-going-process/on-going-process';
import { PopupProvider } from '../../../../../providers/popup/popup';
import { ProfileProvider } from '../../../../../providers/profile/profile';
import { PushNotificationsProvider } from '../../../../../providers/push-notifications/push-notifications';
import { TxFormatProvider } from '../../../../../providers/tx-format/tx-format';
import {
  Coin,
  WalletOptions,
  WalletProvider
} from '../../../../../providers/wallet/wallet';
import { WalletTabsChild } from '../../../../wallet-tabs/wallet-tabs-child';
import { WalletTabsProvider } from '../../../../wallet-tabs/wallet-tabs.provider';

@Component({
  selector: 'page-bitcoin-cash',
  templateUrl: 'bitcoin-cash.html'
})
export class FcashCashPage extends WalletTabsChild {
  private errors;

  public availableWallet;
  public nonEligibleWallet;
  public error;
  public wallet;

  constructor(
    private walletProvider: WalletProvider,
    public profileProvider: ProfileProvider,
    private txFormatProvider: TxFormatProvider,
    private onGoingProcessProvider: OnGoingProcessProvider,
    private popupProvider: PopupProvider,
    private pushNotificationsProvider: PushNotificationsProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private fwcErrorProvider: FwcErrorProvider,
    private fwcProvider: FwcProvider,
    private logger: Logger,
    private translate: TranslateService,
    private events: Events,
    private navParams: NavParams,
    public navCtrl: NavController,
    public walletTabsProvider: WalletTabsProvider
  ) {
    super(navCtrl, profileProvider, walletTabsProvider);
    this.errors = this.fwcProvider.getErrors();
  }

  ionViewWillEnter() {
    this.wallet = this.profileProvider.getWallet(this.navParams.data.walletId);

    // Filter out already duplicated wallets
    let walletsBCH = this.profileProvider.getWallets({
      coin: 'bch',
      network: 'livenet'
    });

    let xPubKeyIndex = lodash.keyBy(walletsBCH, 'credentials.xPubKey');

    if (xPubKeyIndex[this.wallet.credentials.xPubKey]) {
      this.wallet.excludeReason = this.translate.instant('Already duplicated');
      this.nonEligibleWallet = this.wallet;
    } else if (this.wallet.credentials.derivationStrategy != 'BIP44') {
      this.wallet.excludeReason = this.translate.instant('Non BIP44 wallet');
      this.nonEligibleWallet = this.wallet;
    } else if (!this.wallet.canSign()) {
      this.wallet.excludeReason = this.translate.instant('Read only wallet');
      this.nonEligibleWallet = this.wallet;
    } else if (this.wallet.needsBackup) {
      this.wallet.excludeReason = this.translate.instant('Needs backup');
      this.nonEligibleWallet = this.wallet;
    } else {
      this.availableWallet = this.wallet;
    }

    if (!this.availableWallet) return;

    this.walletProvider
      .getBalance(this.availableWallet, { coin: 'bch' })
      .then(balance => {
        this.availableWallet.bchBalance = this.txFormatProvider.formatAmountStr(
          'bch',
          balance.availableAmount
        );
        this.availableWallet.error = null;
      })
      .catch(err => {
        this.availableWallet.error =
          err === 'WALLET_NOT_REGISTERED'
            ? this.translate.instant('Wallet not registered')
            : this.fwcErrorProvider.msg(err);
        this.logger.error(err);
      });
  }

  public duplicate(wallet) {
    this.logger.info(
      'Duplicating wallet for BCH: ' + wallet.id + ': ' + wallet.name
    );

    let opts: Partial<WalletOptions> = {
      name: wallet.name + '[BCH]',
      m: wallet.m,
      n: wallet.n,
      myName: wallet.credentials.fcashpayName,
      networkName: wallet.network,
      coin: Coin.BCH,
      walletPrivKey: wallet.credentials.walletPrivKey,
      compliantDerivation: wallet.credentials.compliantDerivation
    };

    const setErr = err => {
      this.fwcErrorProvider.cb(err, 'Could not duplicate').then(errorMsg => {
        this.logger.warn('Duplicate BCH', errorMsg);
        this.popupProvider.ionicAlert(errorMsg, null, 'OK');
        return;
      });
    };

    const importOrCreate: () => Promise<{
      newWallet: any;
      isNew?: boolean;
    }> = () => {
      return new Promise((resolve, reject) => {
        this.walletProvider
          .getStatus(wallet, {})
          .then(status => {
            opts.singleAddress = status.wallet.singleAddress;

            // first try to import
            this.profileProvider
              .importExtendedPrivateKey(opts.extendedPrivateKey, opts)
              .then(newWallet => {
                return resolve({ newWallet });
              })
              .catch(err => {
                if (!(err instanceof this.errors.NOT_AUTHORIZED)) {
                  return reject(err);
                }
                // create and store a wallet
                this.profileProvider
                  .createWallet(opts)
                  .then(newWallet => {
                    return resolve({ newWallet, isNew: true });
                  })
                  .catch(err => {
                    return reject(err);
                  });
              });
          })
          .catch(err => {
            return reject(err);
          });
      });
    };

    this.walletProvider
      .getKeys(wallet)
      .then(keys => {
        opts.extendedPrivateKey = keys.xPrivKey;
        this.onGoingProcessProvider.set('duplicatingWallet');
        importOrCreate()
          .then(result => {
            let newWallet = result.newWallet;
            let isNew = result.isNew;

            this.walletProvider.updateRemotePreferences(newWallet);
            this.pushNotificationsProvider.updateSubscription(newWallet);

            // Multisig wallets? add FcashApp
            this.addFcashApp(wallet, newWallet, isNew)
              .then(() => {
                this.onGoingProcessProvider.clear();

                if (isNew) {
                  this.walletProvider.startScan(newWallet).catch(err => {
                    this.logger.warn(err);
                  });
                }
                this.events.publish('status:updated');
                this.close();
              })
              .catch(err => {
                this.onGoingProcessProvider.clear();
                setErr(err);
              });
          })
          .catch(err => {
            this.onGoingProcessProvider.clear();
            setErr(err);
          });
      })
      .catch(err => {
        if (
          err &&
          err.message != 'FINGERPRINT_CANCELLED' &&
          err.message != 'PASSWORD_CANCELLED'
        ) {
          setErr(this.fwcErrorProvider.msg(err));
        }
      });
  }

  private addFcashApp(wallet, newWallet, isNew): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!isNew) return resolve();
      if (wallet.n == 1) return resolve();

      this.logger.debug(
        'Adding fcashpay for BCH wallet config:' + wallet.m + '-' + wallet.n
      );

      this.walletProvider
        .copyFcashApp(wallet, newWallet)
        .then(() => {
          return resolve();
        })
        .catch(err => {
          return reject(err);
        });
    });
  }

  public openHelpExternalLink(): void {
    let url =
      'https://support.fcash.cash/hc/en-us/articles/115005019583-How-Can-I-Recover-Fcash-Cash-BCH-from-My-Wallet-';
    let optIn = true;
    let title = null;
    let message = this.translate.instant(
      'Help and support information is available at the website'
    );
    let okText = this.translate.instant('Open');
    let cancelText = this.translate.instant('Go Back');
    this.externalLinkProvider.open(
      url,
      optIn,
      title,
      message,
      okText,
      cancelText
    );
  }
}
