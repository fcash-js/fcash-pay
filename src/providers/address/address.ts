import { Injectable } from '@angular/core';

// Providers
import { FwcProvider } from '../../providers/fwc/fwc';

@Injectable()
export class AddressProvider {
  private fcashBase;
  private fcashBaseCash;
  private Fcash;

  constructor(private fwcProvider: FwcProvider) {
    this.fcashBase = this.fwcProvider.getFcash();
    this.fcashBaseCash = this.fwcProvider.getFcashCash();
    this.Fcash = {
      btc: {
        lib: this.fcashBase,
        translateTo: 'bch'
      },
      bch: {
        lib: this.fcashBaseCash,
        translateTo: 'btc'
      }
    };
  }

  public getCoin(address: string) {
    address = address.replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '');
    try {
      new this.Fcash['btc'].lib.Address(address);
      return 'btc';
    } catch (e) {
      try {
        new this.Fcash['bch'].lib.Address(address);
        return 'bch';
      } catch (e) {
        return null;
      }
    }
  }

  public getNetwork(address: string) {
    address = address.replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '');
    let network;
    try {
      network = this.fwcProvider.getFcash().Address(address).network.name;
    } catch (e) {
      try {
        network = this.fwcProvider.getFcashCash().Address(address).network
          .name;
      } catch (e) {}
    }
    return network;
  }

  private translateAddress(address: string) {
    var origCoin = this.getCoin(address);
    if (!origCoin) return undefined;

    var origAddress = new this.Fcash[origCoin].lib.Address(address);
    var origObj = origAddress.toObject();

    var resultCoin = this.Fcash[origCoin].translateTo;
    var resultAddress = this.Fcash[resultCoin].lib.Address.fromObject(
      origObj
    );
    return {
      origCoin,
      origAddress: address,
      resultCoin,
      resultAddress: resultAddress.toString()
    };
  }

  public validateAddress(address: string) {
    let Address = this.fcashBase.Address;
    let AddressCash = this.fcashBaseCash.Address;
    let isLivenet = Address.isValid(address, 'livenet');
    let isTestnet = Address.isValid(address, 'testnet');
    let isLivenetCash = AddressCash.isValid(address, 'livenet');
    let isTestnetCash = AddressCash.isValid(address, 'testnet');
    return {
      address,
      isValid: isLivenet || isTestnet || isLivenetCash || isTestnetCash,
      network: isTestnet || isTestnetCash ? 'testnet' : 'livenet',
      coin: this.getCoin(address),
      translation: this.translateAddress(address)
    };
  }

  public checkCoinAndNetwork(
    coin: string,
    network: string,
    address: string
  ): boolean {
    let addressData;
    if (this.isValid(address)) {
      let extractedAddress = this.extractAddress(address);
      addressData = this.validateAddress(extractedAddress);
      return addressData.coin == coin
        ? addressData.network == network
          ? true
          : false
        : false;
    } else {
      return false;
    }
  }

  public extractAddress(address: string): string {
    let extractedAddress = address
      .replace(/^(bitcoincash:|bchtest:|bitcoin:)/i, '')
      .replace(/\?.*/, '');
    return extractedAddress || address;
  }

  public isValid(address: string): boolean {
    let URI = this.fcashBase.URI;
    let Address = this.fcashBase.Address;
    let URICash = this.fcashBaseCash.URI;
    let AddressCash = this.fcashBaseCash.Address;

    // Bip21 uri
    let uri, isAddressValidLivenet, isAddressValidTestnet;
    if (/^bitcoin:/.test(address)) {
      let isUriValid = URI.isValid(address);
      if (isUriValid) {
        uri = new URI(address);
        isAddressValidLivenet = Address.isValid(
          uri.address.toString(),
          'livenet'
        );
        isAddressValidTestnet = Address.isValid(
          uri.address.toString(),
          'testnet'
        );
      }
      if (isUriValid && (isAddressValidLivenet || isAddressValidTestnet)) {
        return true;
      }
    } else if (/^bitcoincash:/i.test(address) || /^bchtest:/i.test(address)) {
      let isUriValid = URICash.isValid(address);
      if (isUriValid) {
        uri = new URICash(address);
        isAddressValidLivenet = AddressCash.isValid(
          uri.address.toString(),
          'livenet'
        );
        isAddressValidTestnet = AddressCash.isValid(
          uri.address.toString(),
          'testnet'
        );
      }
      if (isUriValid && (isAddressValidLivenet || isAddressValidTestnet)) {
        return true;
      }
    }

    // Regular Address: try Fcash and Fcash Cash
    let regularAddressLivenet = Address.isValid(address, 'livenet');
    let regularAddressTestnet = Address.isValid(address, 'testnet');
    let regularAddressCashLivenet = AddressCash.isValid(address, 'livenet');
    let regularAddressCashTestnet = AddressCash.isValid(address, 'testnet');
    if (
      regularAddressLivenet ||
      regularAddressTestnet ||
      regularAddressCashLivenet ||
      regularAddressCashTestnet
    ) {
      return true;
    }

    return false;
  }
}
