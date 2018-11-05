import EmberError from '@ember/error';
import Ember from 'ember';
import StripeMock from 'ember-stripe-service/utils/stripe-mock';
import config from '../config/environment';

export function initialize() {
  const application = arguments[1] || arguments[0];
  let stripeConfig = config.stripe || {};

  stripeConfig.debug = stripeConfig.debug || config.LOG_STRIPE_SERVICE;

  application.register('config:stripe', stripeConfig, { instantiate: false });
  application.inject('service:stripe', 'config', 'config:stripe');

  if (stripeConfig.debug) {
    Ember.Logger.info('StripeService: initialize');
  }

  if (!stripeConfig.publishableKey) {
    throw new EmberError("StripeService: Missing Stripe key, please set `ENV.stripe.publishableKey` in config.environment.js");
  }

  // TODO: add some warnings here about expected params if terminal is enabled.

  if (typeof FastBoot !== 'undefined' || stripeConfig.mock) {
    window.Stripe = StripeMock;
  }
}

export default {
  name: 'ember-stripe-service',
  initialize: initialize
};
