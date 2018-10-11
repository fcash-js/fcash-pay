import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Events } from 'ionic-angular';
import { Logger } from '../../providers/logger/logger';

// providers
import { ActionSheetProvider } from '../action-sheet/action-sheet';
import { AppProvider } from '../app/app';
import { FwcProvider } from '../fwc/fwc';
import { PayproProvider } from '../paypro/paypro';
import { Coin } from '../wallet/wallet';

export interface RedirParams {
  activePage?: any;
  amount?: string;
  coin?: Coin;
  fromHomeCard?: boolean;
}

@Injectable()
export class IncomingDataProvider {
  constructor(
    private actionSheetProvider: ActionSheetProvider,
    private events: Events,
    private fwcProvider: FwcProvider,
    private payproProvider: PayproProvider,
    private logger: Logger,
    private appProvider: AppProvider,
    private translate: TranslateService
  ) {
    this.logger.debug('IncomingDataProvider initialized');
  }

  public showMenu(data): void {
    const dataMenu = this.actionSheetProvider.createIncomingDataMenu({ data });
    dataMenu.present();
    dataMenu.onDidDismiss(data => this.finishIncomingData(data));
  }

  public finishIncomingData(data: any): void {
    let redirTo = null;
    let value = null;
    if (data) {
      redirTo = data.redirTo;
      value = data.value;
    }
    if (redirTo === 'AmountPage') {
      let coin = data.coin ? data.coin : 'btc';
      this.events.publish('finishIncomingDataMenuEvent', {
        redirTo,
        value,
        coin
      });
    } else {
      this.events.publish('finishIncomingDataMenuEvent', { redirTo, value });
    }
  }

  private isValidPayProNonBackwardsCompatible(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!/^bitcoin(cash)?:\?r=[\w+]/.exec(data);
  }

  private isValidFcashUri(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!this.fwcProvider.getFcash().URI.isValid(data);
  }

  private isValidFcashCashUri(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!this.fwcProvider.getFcashCash().URI.isValid(data);
  }

  public isValidFcashCashUriWithLegacyAddress(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!this.fwcProvider
      .getFcash()
      .URI.isValid(data.replace(/^(bitcoincash:|bchtest:)/, 'bitcoin:'));
  }

  private isValidPlainUrl(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!/^https?:\/\//.test(data);
  }

  private isValidFcashAddress(data: string): boolean {
    return !!(
      this.fwcProvider.getFcash().Address.isValid(data, 'livenet') ||
      this.fwcProvider.getFcash().Address.isValid(data, 'testnet')
    );
  }

  public isValidFcashCashLegacyAddress(data: string): boolean {
    return !!(
      this.fwcProvider.getFcash().Address.isValid(data, 'livenet') ||
      this.fwcProvider.getFcash().Address.isValid(data, 'testnet')
    );
  }

  private isValidFcashCashAddress(data: string): boolean {
    return !!(
      this.fwcProvider.getFcashCash().Address.isValid(data, 'livenet') ||
      this.fwcProvider.getFcashCash().Address.isValid(data, 'testnet')
    );
  }

  private isValidGlideraUri(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!(
      data && data.indexOf(this.appProvider.info.name + '://glidera') === 0
    );
  }

  private isValidCoinbaseUri(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!(
      data && data.indexOf(this.appProvider.info.name + '://coinbase') === 0
    );
  }

  private isValidFcashCardUri(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!(data && data.indexOf('fcash://fcash.cash?secret=') === 0);
  }

  private isValidJoinCode(data: string): boolean {
    data = this.sanitizeUri(data);
    return !!(data && data.match(/^fcash:[0-9A-HJ-NP-Za-km-z]{70,80}$/));
  }

  private isValidJoinLegacyCode(data: string): boolean {
    return !!(data && data.match(/^[0-9A-HJ-NP-Za-km-z]{70,80}$/));
  }

  private isValidPrivateKey(data: string): boolean {
    return !!(
      data &&
      (data.substring(0, 2) == '6P' || this.checkPrivateKey(data))
    );
  }

  private isValidImportPrivateKey(data: string): boolean {
    return !!(
      data &&
      (data.substring(0, 2) == '1|' ||
        data.substring(0, 2) == '2|' ||
        data.substring(0, 2) == '3|')
    );
  }

  private handlePrivateKey(data: string, redirParams?: RedirParams): void {
    this.logger.debug('Incoming-data: private key');
    this.showMenu({
      data,
      type: 'privateKey',
      fromHomeCard: redirParams ? redirParams.fromHomeCard : false
    });
  }

  private handlePayProNonBackwardsCompatible(data: string): void {
    this.logger.debug(
      'Incoming-data: Payment Protocol with non-backwards-compatible request'
    );
    let coin = data.indexOf('bitcoincash') === 0 ? Coin.BCH : Coin.BTC;
    data = decodeURIComponent(data.replace(/bitcoin(cash)?:\?r=/, ''));

    this.goToPayPro(data, coin);
  }

  private handleFcashUri(data: string, redirParams?: RedirParams): void {
    this.logger.debug('Incoming-data: Fcash URI');
    let amountFromRedirParams =
      redirParams && redirParams.amount ? redirParams.amount : '';
    const coin = Coin.BTC;
    let parsed = this.fwcProvider.getFcash().URI(data);
    let address = parsed.address ? parsed.address.toString() : '';
    let message = parsed.message;
    let amount = parsed.amount || amountFromRedirParams;
    if (parsed.r) this.goToPayPro(data, coin);
    else this.goSend(address, amount, message, coin);
  }

  private handleFcashCashUri(data: string, redirParams?: RedirParams): void {
    this.logger.debug('Incoming-data: Fcash Cash URI');
    let amountFromRedirParams =
      redirParams && redirParams.amount ? redirParams.amount : '';
    const coin = Coin.BCH;
    let parsed = this.fwcProvider.getFcashCash().URI(data);
    let address = parsed.address ? parsed.address.toString() : '';

    // keep address in original format
    if (parsed.address && data.indexOf(address) < 0) {
      address = parsed.address.toCashAddress();
    }

    let message = parsed.message;
    let amount = parsed.amount || amountFromRedirParams;

    if (parsed.r) this.goToPayPro(data, coin);
    else this.goSend(address, amount, message, coin);
  }

  private handleFcashCashUriLegacyAddress(data: string): void {
    this.logger.debug('Incoming-data: Fcash Cash URI with legacy address');
    const coin = Coin.BCH;
    let parsed = this.fwcProvider
      .getFcash()
      .URI(data.replace(/^(bitcoincash:|bchtest:)/, 'bitcoin:'));

    let oldAddr = parsed.address ? parsed.address.toString() : '';
    if (!oldAddr)
      this.logger.error('Could not parse Fcash Cash legacy address');

    let a = this.fwcProvider
      .getFcash()
      .Address(oldAddr)
      .toObject();
    let address = this.fwcProvider
      .getFcashCash()
      .Address.fromObject(a)
      .toString();
    let message = parsed.message;
    let amount = parsed.amount ? parsed.amount : '';

    // Translate address
    this.logger.warn('Legacy Fcash Address transalated to: ' + address);
    if (parsed.r) this.goToPayPro(data, coin);
    else this.goSend(address, amount, message, coin);
  }

  private handlePlainUrl(data: string): void {
    this.logger.debug('Incoming-data: Plain URL');
    data = this.sanitizeUri(data);
    this.showMenu({
      data,
      type: 'url'
    });
  }

  private handlePlainFcashAddress(
    data: string,
    redirParams?: RedirParams
  ): void {
    this.logger.debug('Incoming-data: Fcash plain address');
    const coin = Coin.BTC;
    if (redirParams && redirParams.activePage === 'ScanPage') {
      this.showMenu({
        data,
        type: 'bitcoinAddress',
        coin
      });
    } else if (redirParams && redirParams.amount) {
      this.goSend(data, redirParams.amount, '', coin);
    } else {
      this.goToAmountPage(data, coin);
    }
  }

  private handlePlainFcashCashAddress(
    data: string,
    redirParams?: RedirParams
  ): void {
    this.logger.debug('Incoming-data: Fcash Cash plain address');
    const coin = Coin.BCH;
    if (redirParams && redirParams.activePage === 'ScanPage') {
      this.showMenu({
        data,
        type: 'bitcoinAddress',
        coin
      });
    } else if (redirParams && redirParams.amount) {
      this.goSend(data, redirParams.amount, '', coin);
    } else {
      this.goToAmountPage(data, coin);
    }
  }

  private goToImportByPrivateKey(data: string): void {
    this.logger.debug('Incoming-data (redirect): QR code export feature');

    let stateParams = { code: data, fromScan: true };
    let nextView = {
      name: 'ImportWalletPage',
      params: stateParams
    };
    this.events.publish('IncomingDataRedir', nextView);
  }

  private goToJoinWallet(data: string): void {
    this.logger.debug('Incoming-data (redirect): Code to join to a wallet');
    if (this.isValidJoinCode(data)) {
      let stateParams = { url: data, fromScan: true };
      let nextView = {
        name: 'JoinWalletPage',
        params: stateParams
      };
      this.events.publish('IncomingDataRedir', nextView);
    } else if (this.isValidJoinLegacyCode(data)) {
      let stateParams = { url: data, fromScan: true };
      let nextView = {
        name: 'JoinWalletPage',
        params: stateParams
      };
      this.events.publish('IncomingDataRedir', nextView);
    } else {
      this.logger.error('Incoming-data: Invalid code to join to a wallet');
    }
  }

  private goToFcashCard(data: string): void {
    this.logger.debug('Incoming-data (redirect): Fcash Card URL');

    // Disable Fcash Card
    if (!this.appProvider.info._enabledExtensions.debitcard) {
      this.logger.warn('Fcash Card has been disabled for this build');
      return;
    }

    let secret = this.getParameterByName('secret', data);
    let email = this.getParameterByName('email', data);
    let otp = this.getParameterByName('otp', data);
    let reason = this.getParameterByName('r', data);
    switch (reason) {
      default:
      case '0':
        /* For Fcash card binding */
        let stateParams = { secret, email, otp };
        let nextView = {
          name: 'FcashCardIntroPage',
          params: stateParams
        };
        this.events.publish('IncomingDataRedir', nextView);
        break;
    }
  }

  private goToCoinbase(data: string): void {
    this.logger.debug('Incoming-data (redirect): Coinbase URL');

    let code = this.getParameterByName('code', data);
    let stateParams = { code };
    let nextView = {
      name: 'CoinbasePage',
      params: stateParams
    };
    this.events.publish('IncomingDataRedir', nextView);
  }

  private goToGlidera(data: string): void {
    this.logger.debug('Incoming-data (redirect): Glidera URL');

    let code = this.getParameterByName('code', data);
    let stateParams = { code };
    let nextView = {
      name: 'GlideraPage',
      params: stateParams
    };
    this.events.publish('IncomingDataRedir', nextView);
  }

  public redir(data: string, redirParams?: RedirParams): boolean {
    // Payment Protocol with non-backwards-compatible request
    if (this.isValidPayProNonBackwardsCompatible(data)) {
      this.handlePayProNonBackwardsCompatible(data);
      return true;

      // Fcash  URI
    } else if (this.isValidFcashUri(data)) {
      this.handleFcashUri(data, redirParams);
      return true;

      // Fcash Cash URI
    } else if (this.isValidFcashCashUri(data)) {
      this.handleFcashCashUri(data, redirParams);
      return true;

      // Fcash Cash URI using Fcash Core legacy address
    } else if (this.isValidFcashCashUriWithLegacyAddress(data)) {
      this.handleFcashCashUriLegacyAddress(data);
      return true;

      // Plain URL
    } else if (this.isValidPlainUrl(data)) {
      this.handlePlainUrl(data);
      return true;

      // Plain Address (Fcash)
    } else if (this.isValidFcashAddress(data)) {
      this.handlePlainFcashAddress(data, redirParams);
      return true;

      // Plain Address (Fcash Cash)
    } else if (this.isValidFcashCashAddress(data)) {
      this.handlePlainFcashCashAddress(data, redirParams);
      return true;

      // Glidera
    } else if (this.isValidGlideraUri(data)) {
      this.goToGlidera(data);
      return true;

      // Coinbase
    } else if (this.isValidCoinbaseUri(data)) {
      this.goToCoinbase(data);
      return true;

      // FcashCard Authentication
    } else if (this.isValidFcashCardUri(data)) {
      this.goToFcashCard(data);
      return true;

      // Join
    } else if (this.isValidJoinCode(data) || this.isValidJoinLegacyCode(data)) {
      this.goToJoinWallet(data);
      return true;

      // Check Private Key
    } else if (this.isValidPrivateKey(data)) {
      this.handlePrivateKey(data, redirParams);
      return true;

      // Import Private Key
    } else if (this.isValidImportPrivateKey(data)) {
      this.goToImportByPrivateKey(data);
      return true;

      // Anything else
    } else {
      if (redirParams && redirParams.activePage === 'ScanPage') {
        this.logger.debug('Incoming-data: Plain text');
        this.showMenu({
          data,
          type: 'text'
        });
        return true;
      } else {
        this.logger.warn('Incoming-data: Unknown information');
        return false;
      }
    }
  }

  public parseData(data: string): any {
    if (!data) return;
    if (this.isValidPayProNonBackwardsCompatible(data)) {
      return {
        data,
        type: 'PayPro',
        title: this.translate.instant('Payment URL')
      };

      // Fcash  URI
    } else if (this.isValidFcashUri(data)) {
      return {
        data,
        type: 'FcashUri',
        title: this.translate.instant('Fcash URI')
      };

      // Fcash Cash URI
    } else if (this.isValidFcashCashUri(data)) {
      return {
        data,
        type: 'FcashCashUri',
        title: this.translate.instant('Fcash Cash URI')
      };

      // Fcash Cash URI using Fcash Core legacy address
    } else if (this.isValidFcashCashUriWithLegacyAddress(data)) {
      return {
        data,
        type: 'FcashCashUri',
        title: this.translate.instant('Fcash Cash URI')
      };

      // Plain URL
    } else if (this.isValidPlainUrl(data)) {
      return {
        data,
        type: 'PlainUrl',
        title: this.translate.instant('Plain URL')
      };

      // Plain Address (Fcash)
    } else if (this.isValidFcashAddress(data)) {
      return {
        data,
        type: 'FcashAddress',
        title: this.translate.instant('Fcash Address')
      };

      // Plain Address (Fcash Cash)
    } else if (this.isValidFcashCashAddress(data)) {
      return {
        data,
        type: 'FcashCashAddress',
        title: this.translate.instant('Fcash Cash Address')
      };

      // Glidera
    } else if (this.isValidGlideraUri(data)) {
      return {
        data,
        type: 'Glidera',
        title: 'Glidera URI'
      };

      // Coinbase
    } else if (this.isValidCoinbaseUri(data)) {
      return {
        data,
        type: 'Coinbase',
        title: 'Coinbase URI'
      };

      // FcashCard Authentication
    } else if (this.isValidFcashCardUri(data)) {
      return {
        data,
        type: 'FcashCard',
        title: this.translate.instant('Fcash Card URI')
      };

      // Join
    } else if (this.isValidJoinCode(data) || this.isValidJoinLegacyCode(data)) {
      return {
        data,
        type: 'JoinWallet',
        title: this.translate.instant('Invitation Code')
      };

      // Check Private Key
    } else if (this.isValidPrivateKey(data)) {
      return {
        data,
        type: 'PrivateKey',
        title: this.translate.instant('Private Key')
      };

      // Import Private Key
    } else if (this.isValidImportPrivateKey(data)) {
      return {
        data,
        type: 'ImportPrivateKey',
        title: this.translate.instant('Import Words')
      };

      // Anything else
    } else {
      return;
    }
  }

  private sanitizeUri(data): string {
    // Fixes when a region uses comma to separate decimals
    let regex = /[\?\&]amount=(\d+([\,\.]\d+)?)/i;
    let match = regex.exec(data);
    if (!match || match.length === 0) {
      return data;
    }
    let value = match[0].replace(',', '.');
    let newUri = data.replace(regex, value);

    // mobile devices, uris like fcash://glidera
    newUri.replace('://', ':');

    return newUri;
  }

  private getParameterByName(name: string, url: string): string {
    if (!url) return undefined;
    name = name.replace(/[\[\]]/g, '\\$&');
    let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  private checkPrivateKey(privateKey: string): boolean {
    // Check if it is a Transaction id to prevent errors
    let isPK: boolean = this.checkRegex(privateKey);
    if (!isPK) return false;
    try {
      this.fwcProvider.getFcash().PrivateKey(privateKey, 'livenet');
    } catch (err) {
      return false;
    }
    return true;
  }

  private checkRegex(data: string): boolean {
    let PKregex = new RegExp(/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/);
    return !!PKregex.exec(data);
  }

  private goSend(
    addr: string,
    amount: string,
    message: string,
    coin: Coin
  ): void {
    if (amount) {
      let stateParams = {
        amount,
        toAddress: addr,
        description: message,
        coin
      };
      let nextView = {
        name: 'ConfirmPage',
        params: stateParams
      };
      this.events.publish('IncomingDataRedir', nextView);
    } else {
      let stateParams = {
        toAddress: addr,
        description: message,
        coin
      };
      let nextView = {
        name: 'AmountPage',
        params: stateParams
      };
      this.events.publish('IncomingDataRedir', nextView);
    }
  }

  private goToAmountPage(toAddress: string, coin: Coin): void {
    let stateParams = {
      toAddress,
      coin
    };
    let nextView = {
      name: 'AmountPage',
      params: stateParams
    };
    this.events.publish('IncomingDataRedir', nextView);
  }

  private goToPayPro(url: string, coin: Coin): void {
    this.payproProvider
      .getPayProDetails(url, coin)
      .then(details => {
        this.handlePayPro(details, coin);
      })
      .catch(err => {
        this.logger.error(err);
      });
  }

  private handlePayPro(payProDetails, coin?: Coin): void {
    if (!payProDetails) {
      this.logger.error('No wallets available');
      const error = this.translate.instant('No wallets available');
      this.events.publish('incomingDataError', error);
      return;
    }

    const stateParams = {
      amount: payProDetails.amount,
      toAddress: payProDetails.toAddress,
      description: payProDetails.memo,
      paypro: payProDetails,
      coin,
      requiredFeeRate: payProDetails.requiredFeeRate
        ? Math.ceil(payProDetails.requiredFeeRate * 1024)
        : undefined
    };
    const nextView = {
      name: 'ConfirmPage',
      params: stateParams
    };
    this.events.publish('IncomingDataRedir', nextView);
  }

  public getPayProDetails(data: string): Promise<any> {
    let coin: string = data.indexOf('bitcoincash') === 0 ? Coin.BCH : Coin.BTC;
    data = decodeURIComponent(data.replace(/bitcoin(cash)?:\?r=/, ''));

    let disableLoader = true;
    return this.payproProvider.getPayProDetails(data, coin, disableLoader);
  }
}
