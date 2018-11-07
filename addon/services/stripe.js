/* global Stripe, StripeTerminal */
import { resolve, Promise as EmberPromise, hash } from 'rsvp';

import { isEqual, typeOf } from '@ember/utils';
import { registerWaiter } from '@ember/test';
import { readOnly } from '@ember/object/computed';
import { default as Service, inject as service } from '@ember/service';
import Ember from 'ember';
import loadScript from 'ember-stripe-service/utils/load-script';

const defaultCoreSdkUrl = 'https://js.stripe.com/v2/';
const defaultTerminalSdkUrl = 'https://js.stripe.com/terminal/v1/sdk-b1.js';

export default Service.extend({
  didConfigure: false,
  config: null,
  // DONE: add service var for the terminal
  terminal: null,
  terminalTokenService: null,
  connectedReader: null,

  lazyLoad: readOnly('config.lazyLoad'),
  mock: readOnly('config.mock'),
  publishableKey: readOnly('config.publishableKey'),
  debuggingEnabled: readOnly('config.debug'),

  // DONE: add property to track enabling terminal functionality
  terminalEnabled: readOnly('config.terminalEnabled'),
  // DONE: add property for the get terminal token url to call
  terminalServiceName: readOnly('config.terminalTokenServiceName'),

  runCount: 0,

  async init() {
    this.debug('entering stripe init...');
    this._super(...arguments);
    const lazyLoad = this.get('lazyLoad');
    const mock = this.get('mock');
    const terminalEnabled = this.get('terminalEnabled') || false;

    this.debug('lazyloading? ', lazyLoad);
    this.debug('use mocks? ', mock);
    this.debug('terminal enabled? ', terminalEnabled);

    if (Ember.testing) {
      this._waiter = () => {
        return this.get('runCount') === 0;
      };
      registerWaiter(this._waiter);
    }

    if (terminalEnabled) {
      // dynamically inject the service only if enabled
      this.set('terminalTokenService', service(this.get('terminalServiceName')));
    }

    if (!lazyLoad || mock) {
      this.configure();
    }
    this.debug('exiting stripe init.');
  },

  load() {
    this.debug('entering load...');
    const lazyLoad = this.get('lazyLoad');
    const mock = this.get('mock');
    const config = this.get('config');
    this.debug('stripe config: ', config);
    const terminalEnabled = this.get('terminalEnabled');
    this.debug('stripe terminal enabled? ', terminalEnabled);

    // DONE: (Step 1) also load the terminal script when enabled
    const loadCoreSdk = lazyLoad && !mock ? loadScript(defaultCoreSdkUrl) : resolve();
    const loadTerminalSdk = lazyLoad && terminalEnabled ? loadScript(defaultTerminalSdkUrl) : resolve();
    const loadTerminalAction = lazyLoad && terminalEnabled ? 'loaded' : 'skipped';

    return resolve()
    .then(() => loadCoreSdk)
    .then(() => this.debug('core stripe script loaded'))
    .then(() => loadTerminalSdk)
    .then(() => this.debug(`stripe terminal script ${loadTerminalAction}`))
    .then(() => {
      this.configure();
      this.debug('leaving load...');
    });
  },

  configure() {
    this.debug('entering configure...');
    let didConfigure = this.get('didConfigure');

    if (!didConfigure) {
      this.debug('starting configuration...');
      let publishableKey = this.get('publishableKey');
      Stripe.setPublishableKey(publishableKey);

      this.card = {
        createToken: this._createCardToken.bind(this)
      };

      this.bankAccount = {
        createToken: this._createBankAccountToken.bind(this)
      };

      this.piiData = {
        createToken: this._createPiiDataToken.bind(this)
      };
      
      this._checkForAndAddCardFn('cardType', Stripe.card.cardType);
      this._checkForAndAddCardFn('validateCardNumber', Stripe.card.validateCardNumber);
      this._checkForAndAddCardFn('validateCVC', Stripe.card.validateCVC);
      this._checkForAndAddCardFn('validateExpiry', Stripe.card.validateExpiry);
      
      // DONE: (Step 2) wire up terminal createToken event
      // DONE: (Step 3) initialize the terminal object if enabled 
      const terminalEnabled = this.get('terminalEnabled');
      if (terminalEnabled) {
        // DONE: (Step 3) wire up terminal token service to get connection tokens from implementors backend
        const terminalTokenService = this.get('terminalTokenService');
        const fetchTokenFunction = terminalTokenService.getFetchConnectionTokenFn();
        const terminal = StripeTerminal.create({
          // fetchConnectionToken must be a function that returns a promise
          onFetchConnectionToken: fetchTokenFunction
        });
        this.set('terminal', terminal);
      }
      this.set('didConfigure', true);
    }
    this.debug('leaving configure...');
  },

  stripePromise(callback) {
    return this.load().then(() => {
      return new EmberPromise((resolve, reject) => {
        callback(resolve, reject);
      });
    });
  },

  /**
  * Creates a creditCard token using Stripe.js API, exposed as `card.createToken`
  * @param  {ojbect} card  CreditCard
  * @return {promise}      Returns a promise that holds response, see stripe.js docs for details
  *                        status is not being returned at the moment but it can be logged
  */
  _createCardToken(card) {
    this.debug('card.createToken:', card);
    this.incrementProperty('runCount');

    return this.stripePromise((resolve, reject) => {
      Stripe.card.createToken(card, (status, response) => {
        this.debug('card.createToken handler - status %s, response:', status, response);

        if (response.error) {
          reject(response);
        } else {
          resolve(response);
        }

        this.decrementProperty('runCount');
      });
    });
  },

  /**
  * Creates a BankAccout token using Stripe.js API, exposed as `bankAccount.createToken`
  * @param  {ojbect} bankAccount
  * @return {promise}      Returns a promise that holds response, see stripe.js docs for details
  *                        Status is not being returned at the moment but it can be logged
  *
  */
  _createBankAccountToken(bankAccount) {
    this.debug('bankAccount.createToken:', bankAccount);
    this.incrementProperty('runCount');

    return this.stripePromise((resolve, reject) => {
      Stripe.bankAccount.createToken(bankAccount, (status, response) => {

        this.debug('bankAccount.createToken handler - status %s, response:', status, response);

        if (response.error) {
          reject(response);
        } else {
          resolve(response);
        }

        this.decrementProperty('runCount');
      });
    });
  },

  /**
   * Creates a piiData token using Stripe.js API, exposed as `piiData.createToken`
   * @param  {object} piiData  PiiData
   * @return {promise}         Returns a promise that holds response, see stripe.js docs for details
   *                           status is not being returned at the moment but it can be logged
   */
  _createPiiDataToken(piiData) {
    this.debug('piiData.createToken:', piiData);
    this.incrementProperty('runCount');

    return this.stripePromise((resolve, reject) => {
      Stripe.piiData.createToken(piiData, (status, response) => {

        this.debug('piiData.createToken handler - status %s, response:', status, response);

        if (response.error) {
          reject(response);
        } else {
          resolve(response);
        }

        this.decrementProperty('runCount');
      });
    });
  },

  /**
   * Uses Ember.Logger.info to output service information if debugging is
   * set
   *
   * notes:
   * - proxies all arguments to Ember.Logger.info
   * - pre-pends StripeService to all messages
   */
  debug() {
    let debuggingEnabled = this.get('debuggingEnabled');

    if (debuggingEnabled) {
      let args = Array.prototype.slice.call(arguments);
      args[0] = `StripeService: ${args[0]}`;
      Ember.Logger.info.apply(null, args);
    }
  },

  _checkForAndAddCardFn(name, fn) {
    if (isEqual(typeOf(Stripe.card[name]), 'function')) {
      this.card[name] = fn;
    } else {
      this.card[name] = function() {};
      Ember.Logger.error(`ember-cli-stripe: ${name} on Stripe.card is no longer available`);
    }
  },

  
  // DONE: (Step 4) create method to discover readers
  async discoverReaders() {
    const mock = this.get('mock');
    const terminal = this.get('terminal');

    const configuration = {}
    // DONE: (Step 4) when in testing mode use the simulator
    if (mock) {
      configuration.method = 'simulated';
    }
    const discoverResult = await terminal.discoverReaders(configuration);
    if (discoverResult.error) {
      console.error('Failed to discover readers: ', discoverResult.error);
    } else if (discoverResult.discoveredReaders.length === 0) {
      console.log('No available readers.');
    } else {
      // You should show the list of discoveredReaders to the
      // cashier here and let them select which to connect to (see below).
      // this.connectReader(discoverResult);
      console.log('discovered readers: ', discoverResult.discoveredReaders);
      return discoverResult.discoveredReaders;
    }
  },

  // DONE: (Step 4) create method to connect to reader
  async connectReader(reader) {
    // Just select the first reader here.
    // const selectedReader = discoverResult.discoveredReaders[1];
    const terminal = this.get('terminal');
    this.debug('connecting to reader: ', reader);
    const connectResult = await terminal.connectReader(reader);
    this.debug('connection result: ', connectResult);
    this.debug('reader status', terminal.getPaymentStatus());
    if (connectResult.error) {
      console.error('Failed to connect:', connectResult.error);
    } else {
      this.debug('Connected to reader:', connectResult.connection.reader.id);
      this.set('connectedReader', reader);
    }
  },
  // DONE: (Pay Step 1) create method to create a payment intent
  async registerAuthorization(data) {
    this.set('activeAuthorization', data);
  },

  // DONE: (Pay Step 2) create method to collect payment method using payment intent
  async collectPaymentMethod(paymentIntent) {
    // clientSecret is the client_secret from the PaymentIntent you created in Step 1.
    const terminal = this.get('terminal');
    this.debug('confirming payment intent:', paymentIntent);
    const result = await terminal.collectPaymentMethod(paymentIntent['client_secret']);
    if (result.error) {
      console.error(`Collect payment method failed: ${result.error.message}`);
    }
    else {
      this.debug("confirmed payment intent: ", result.paymentIntent);
      // Confirm PaymentIntent (see below)
      // this.set('confirmedAuthorization', result.paymentIntent);
      this.confirmPaymentIntent(result.paymentIntent);
    }
  },

  // DONE: (Pay Step 2) confirm payment intent
  async confirmPaymentIntent(paymentIntent) {
    console.log('confirming authorization!')
    const terminal = this.get('terminal');
    const confirmResult = await terminal.confirmPaymentIntent(paymentIntent);
    if (confirmResult.error) {
      console.error(`Confirm failed: ${confirmResult.error.message}`);
    } else if (confirmResult.paymentIntent) {
      // Placeholder for notifying your backend to capture the PaymentIntent
      console.log('authorization confirmed', confirmResult);
      this.set('confirmedAuthorization', confirmResult.paymentIntent);
    }
  },

  // DONE: (Pay Step 2-1) add option to customize the display while collecting payment
  async setDisplay(data) {
    const terminal = this.get('terminal');
    terminal.setReaderDisplay(data);
  },

  // DONE: (Pay Step 2-2) clear reader display
  async clearDisplay() {
    const terminal = this.get('terminal');
    terminal.clearReaderDisplay();
  },

  // DONE: (Pay Step 2.1) cancel payment intent (in impl app terminal service)

  // TODO: (Pay Step 3): Handle failures
  // TODO: (Pay Step 3): Handle failure: requires_source => payment method declined, try another with updated paymentIntent
  // TODO: (Pay Step 3): Handle failure: requires_confirmation => call confirmPaymentIntent again to retry
  // TODO: (Pay Step 3): Handle failure: other ... unknown errors... 

  // DONE: (Pay Step 4): capture payment intent after success confirmation (in impl app terminal service)

  // TODO: (Pay Step X1): add method to just capture a card without charging (which can be passed to backend to save etc)
  // TODO: (Pay Step X2): add method to save a card present source by converting it to a card source (on backend) 
  // TODO: (Pay Step X3): add mechanism to save the last reader in local storage and allow auto reconecting to that source 
  //   - ref: https://stripe.com/docs/terminal/js/workflows#automatically-connecting
});
