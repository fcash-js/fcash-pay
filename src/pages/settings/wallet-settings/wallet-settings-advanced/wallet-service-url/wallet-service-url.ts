import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Events, NavController, NavParams } from 'ionic-angular';
import { Logger } from '../../../../../providers/logger/logger';

// native
import { SplashScreen } from '@ionic-native/splash-screen';

// providers
import { AppProvider } from '../../../../../providers/app/app';
import { ConfigProvider } from '../../../../../providers/config/config';
import { PersistenceProvider } from '../../../../../providers/persistence/persistence';
import { PlatformProvider } from '../../../../../providers/platform/platform';
import { ProfileProvider } from '../../../../../providers/profile/profile';
import { ReplaceParametersProvider } from '../../../../../providers/replace-parameters/replace-parameters';

@Component({
  selector: 'page-wallet-service-url',
  templateUrl: 'wallet-service-url.html'
})
export class WalletServiceUrlPage {
  public success: boolean = false;
  public wallet;
  public comment: string;
  public walletServiceForm: FormGroup;
  private config;
  private defaults;

  constructor(
    private profileProvider: ProfileProvider,
    private navCtrl: NavController,
    private navParams: NavParams,
    private configProvider: ConfigProvider,
    private app: AppProvider,
    private logger: Logger,
    private persistenceProvider: PersistenceProvider,
    private formBuilder: FormBuilder,
    private events: Events,
    private splashScreen: SplashScreen,
    private platformProvider: PlatformProvider,
    private replaceParametersProvider: ReplaceParametersProvider,
    private translate: TranslateService
  ) {
    this.walletServiceForm = this.formBuilder.group({
      fwsurl: [
        '',
        Validators.compose([Validators.minLength(1), Validators.required])
      ]
    });
  }

  ionViewDidLoad() {
    this.logger.info('Loaded:  WalletServiceUrlPage');
  }

  ionViewWillEnter() {
    this.wallet = this.profileProvider.getWallet(this.navParams.data.walletId);
    this.defaults = this.configProvider.getDefaults();
    this.config = this.configProvider.get();
    let appName = this.app.info.nameCase;
    this.comment = this.replaceParametersProvider.replace(
      this.translate.instant(
        "{{appName}} depends on Fcash Wallet Service (FWS) for blockchain information, networking and Copayer synchronization. The default configuration points to https://fws.fcash.cash (BitPay's public FWS instance)."
      ),
      { appName }
    );
    this.walletServiceForm.value.fwsurl =
      (this.config.fwsFor &&
        this.config.fwsFor[this.wallet.credentials.walletId]) ||
      this.defaults.fws.url;
  }

  public resetDefaultUrl(): void {
    this.walletServiceForm.value.fwsurl = this.defaults.fws.url;
  }

  public save(): void {
    let fws;
    switch (this.walletServiceForm.value.fwsurl) {
      case 'prod':
      case 'production':
        fws = 'https://fws.fcash.cash/fws/api';
        break;
      case 'sta':
      case 'staging':
        fws = 'https://fws-staging.b-pay.net/fws/api';
        break;
      case 'loc':
      case 'local':
        fws = 'http://localhost:3232/fws/api';
        break;
    }
    if (fws) {
      this.logger.info('Using FWS URL Alias to ' + fws);
      this.walletServiceForm.value.fwsurl = fws;
    }

    let opts = {
      fwsFor: {}
    };
    opts.fwsFor[
      this.wallet.credentials.walletId
    ] = this.walletServiceForm.value.fwsurl;

    this.configProvider.set(opts);
    this.persistenceProvider.setCleanAndScanAddresses(
      this.wallet.credentials.walletId
    );
    this.events.publish('wallet:updated', this.wallet.credentials.walletId);
    this.navCtrl.popToRoot().then(() => {
      this.reload();
    });
  }

  private reload(): void {
    window.location.reload();
    if (this.platformProvider.isCordova) this.splashScreen.show();
  }
}
