import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';

import * as _ from 'lodash';

// Providers
import { FcashAccountProvider } from '../../../../providers/fcash-account/fcash-account';
import { FcashCardProvider } from '../../../../providers/fcash-card/fcash-card';
import { ConfigProvider } from '../../../../providers/config/config';
import { HomeIntegrationsProvider } from '../../../../providers/home-integrations/home-integrations';
import { PopupProvider } from '../../../../providers/popup/popup';

@Component({
  selector: 'page-fcash-settings',
  templateUrl: 'fcash-settings.html'
})
export class FcashSettingsPage {
  private serviceName: string = 'debitcard';
  public showAtHome;
  public service;
  public fcashCard;

  constructor(
    private navParams: NavParams,
    private navCtrl: NavController,
    private fcashAccountProvider: FcashAccountProvider,
    private fCashCardProvider: FcashCardProvider,
    private popupProvider: PopupProvider,
    private configProvider: ConfigProvider,
    private homeIntegrationsProvider: HomeIntegrationsProvider
  ) {
    this.service = _.filter(this.homeIntegrationsProvider.get(), {
      name: this.serviceName
    });
    this.showAtHome = !!this.service[0].show;
  }

  ionViewWillEnter() {
    let cardId = this.navParams.data.id;
    if (cardId) {
      this.fCashCardProvider.getCards(cards => {
        this.fcashCard = _.find(cards, { id: cardId });
      });
    } else {
      this.service = _.filter(this.homeIntegrationsProvider.get(), {
        name: this.serviceName
      });
      this.showAtHome = !!this.service[0].show;
    }
  }

  public integrationChange(): void {
    let opts = {
      showIntegration: { [this.serviceName]: this.showAtHome }
    };
    this.homeIntegrationsProvider.updateConfig(
      this.serviceName,
      this.showAtHome
    );
    this.configProvider.set(opts);
  }

  public unlinkCard(card) {
    let title = 'Unlink Fcash Card?';
    let msg =
      'Are you sure you would like to remove your Fcash Card (' +
      card.lastFourDigits +
      ') from this device?';
    this.popupProvider.ionicConfirm(title, msg).then(res => {
      if (res) {
        this.fCashCardProvider.remove(card.id, err => {
          if (err) {
            this.popupProvider.ionicAlert('Error', 'Could not remove the card');
            return;
          }
          this.navCtrl.pop();
        });
      }
    });
  }

  public unlinkAccount(card) {
    let title = 'Unlink Fcash Account?';
    let msg =
      'Are you sure you would like to remove your Fcash Account (' +
      card.email +
      ') and all associated cards from this device?';
    this.popupProvider.ionicConfirm(title, msg).then(res => {
      if (res) {
        this.fcashAccountProvider.removeAccount(card.email, () => {
          this.navCtrl.pop();
        });
      }
    });
  }
}
