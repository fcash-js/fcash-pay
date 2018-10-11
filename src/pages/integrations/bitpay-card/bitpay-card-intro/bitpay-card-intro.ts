import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActionSheetController, NavController, NavParams } from 'ionic-angular';

import * as _ from 'lodash';

// providers
import { FcashAccountProvider } from '../../../../providers/fcash-account/fcash-account';
import { FcashCardProvider } from '../../../../providers/fcash-card/fcash-card';
import { ExternalLinkProvider } from '../../../../providers/external-link/external-link';
import { PopupProvider } from '../../../../providers/popup/popup';

// pages
import { FcashCardPage } from '../fcash-card';

@Component({
  selector: 'page-fcash-card-intro',
  templateUrl: 'fcash-card-intro.html'
})
export class FcashCardIntroPage {
  public accounts;

  constructor(
    private translate: TranslateService,
    private actionSheetCtrl: ActionSheetController,
    private navParams: NavParams,
    private fCashAccountProvider: FcashAccountProvider,
    private popupProvider: PopupProvider,
    private fCashCardProvider: FcashCardProvider,
    private navCtrl: NavController,
    private externalLinkProvider: ExternalLinkProvider
  ) {}

  ionViewWillEnter() {
    if (this.navParams.data.secret) {
      let pairData = {
        secret: this.navParams.data.secret,
        email: this.navParams.data.email,
        otp: this.navParams.data.otp
      };
      let pairingReason = this.translate.instant(
        'add your Fcash Visa card(s)'
      );
      this.fCashAccountProvider.pair(
        pairData,
        pairingReason,
        (err: string, paired: boolean, apiContext) => {
          if (err) {
            this.popupProvider.ionicAlert(
              this.translate.instant('Error pairing Fcash Account'),
              err
            );
            return;
          }
          if (paired) {
            this.fCashCardProvider.sync(apiContext, (err, cards) => {
              if (err) {
                this.popupProvider.ionicAlert(
                  this.translate.instant('Error updating Debit Cards'),
                  err
                );
                return;
              }

              // Fixes mobile navigation
              setTimeout(() => {
                if (cards[0]) {
                  this.navCtrl
                    .push(
                      FcashCardPage,
                      { id: cards[0].id },
                      { animate: false }
                    )
                    .then(() => {
                      let previousView = this.navCtrl.getPrevious();
                      this.navCtrl.removeView(previousView);
                    });
                }
              }, 200);
            });
          }
        }
      );
    }

    this.fCashAccountProvider.getAccounts((err, accounts) => {
      if (err) {
        this.popupProvider.ionicAlert(this.translate.instant('Error'), err);
        return;
      }
      this.accounts = accounts;
    });
  }

  public fCashCardInfo() {
    let url = 'https://fcash.cash/visa/faq';
    this.externalLinkProvider.open(url);
  }

  public orderFcashCard() {
    let url = 'https://fcash.cash/visa/get-started';
    this.externalLinkProvider.open(url);
  }

  public connectFcashCard() {
    if (this.accounts.length == 0) {
      this.startPairFcashAccount();
    } else {
      this.showAccountSelector();
    }
  }

  private startPairFcashAccount() {
    this.navCtrl.popToRoot({ animate: false }); // Back to Root
    let url = 'https://fcash.cash/visa/dashboard/add-to-fcash-wallet-confirm';
    this.externalLinkProvider.open(url);
  }

  private showAccountSelector() {
    let options = [];

    _.forEach(this.accounts, account => {
      options.push({
        text:
          (account.givenName || account.familyName) +
          ' (' +
          account.email +
          ')',
        handler: () => {
          this.onAccountSelect(account);
        }
      });
    });

    // Add account
    options.push({
      text: this.translate.instant('Add account'),
      handler: () => {
        this.onAccountSelect();
      }
    });

    // Cancel
    options.push({
      text: this.translate.instant('Cancel'),
      role: 'cancel'
    });

    let actionSheet = this.actionSheetCtrl.create({
      title: this.translate.instant('From Fcash account'),
      buttons: options
    });
    actionSheet.present();
  }

  private onAccountSelect(account?): void {
    if (_.isUndefined(account)) {
      this.startPairFcashAccount();
    } else {
      this.fCashCardProvider.sync(account.apiContext, err => {
        if (err) {
          this.popupProvider.ionicAlert(this.translate.instant('Error'), err);
          return;
        }
        this.navCtrl.pop();
      });
    }
  }
}
