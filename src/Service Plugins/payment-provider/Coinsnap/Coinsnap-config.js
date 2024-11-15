import * as paymentProvider from "interfaces-psp-v1-payment-service-provider";

/** @returns {import('interfaces-psp-v1-payment-service-provider').PaymentServiceProviderConfig} */
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
          svg: 'https://coinsnap.io/wp-content/uploads/2024/11/coinsnap-logo.svg',
          png: 'https://coinsnap.io/wp-content/uploads/2024/11/coinsnap-logo.png'
        },
        colored: {
          svg: 'https://coinsnap.io/wp-content/uploads/2024/11/coinsnap-logo.svg',
          png: 'https://coinsnap.io/wp-content/uploads/2024/11/coinsnap-logo.png'
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