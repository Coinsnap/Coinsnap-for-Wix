import * as paymentProvider from "interfaces-psp-v1-payment-service-provider";

export function getConfig() {
  return {
    title: "Bitcoin/Lightning ",
    paymentMethods: [
      {
        hostedPage: {
          title: "Bitcoin/Lightning by Coinsnap",
          billingAddressMandatoryFields: ["EMAIL"],
          logos: {
            white: {
          svg: 'https://resources.coinsnap.org/logo/bitcoin-lightning-logo.svg?color=white',
          png: 'https://resources.coinsnap.org/logo/bitcoin-lightning-logo.png?color=white'
        },
        colored: {
          svg: 'https://resources.coinsnap.org/logo/bitcoin-lightning-logo.svg',
          png: 'https://resources.coinsnap.org/logo/bitcoin-lightning-logo.png'
        }
          },
        },
      },
    ],
    credentialsFields: [
      {
        simpleField: {
          name: "apiKey",
          label: "API Key",
        },
      },
      {
        simpleField: {
          name: "storeId",
          label: "Store ID",
        },
      },
      {
        simpleField: {
          name: "webhookSecret",
          label: "Webhook Secret",
        },
      },
    ],
  };
}