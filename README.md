# Coinsnap for Wix

![Coinsnap for Wix](https://resources.coinsnap.org/products/wix/images/cover.png)

**Bitcoin payment integration for Wix — accept Bitcoin and Lightning with Coinsnap or your own BTCPay Server.**

Coinsnap for Wix adds Bitcoin payments to Wix stores through Wix's developer framework. Because Wix does not provide a native Bitcoin payment integration, the Coinsnap setup uses Wix Developer Mode, a custom payment provider service plugin and backend functions.

Customers can pay with **Bitcoin via Lightning or on-chain** while orders remain managed inside the existing Wix backend.

Coinsnap is **Bitcoin payment software for merchants** and a brand of **Onlineshop24 d.o.o., Serbia**.

## Key features

- Accept **Bitcoin and Lightning payments** in Wix
- Support for **Lightning and Bitcoin on-chain**
- Integration with the existing Wix checkout and order workflow
- Built with **Wix Developer Mode / Velo**
- Custom payment provider service plugin
- Backend webhook integration
- Support for **Coinsnap** and **BTCPay Server**
- Optional **Bitcoin discount** with fixed or percentage-based discounts
- No own Lightning node or Bitcoin payment infrastructure required when using Coinsnap
- **Non-custodial / self-custody** approach
- Optional settlement to a compatible Bitcoin wallet or, through supported partners, to a bank account
- Free Coinsnap integration service available
- Open source under the MIT License

## Requirements

To use the Wix integration you need:

- A **Wix Store** with administrator access
- A Wix plan that supports the required e-commerce and developer functionality
- Access to **Wix Developer Mode / Velo**
- A **Coinsnap merchant account**, or your own **BTCPay Server**
- The source files from this repository

For Bitcoin settlement with Coinsnap, you can use a compatible Bitcoin or Lightning wallet. One option is the [Coinsnap Wallet](https://coinsnap.io/wallet/), which combines a self-custodial Bitcoin wallet with merchant and point-of-sale functionality.

## How it works

1. Create a [Coinsnap merchant account](https://app.coinsnap.io/register).
2. Open your Wix site and enable **Developer Mode**.
3. Add a **Payment Provider Service Plugin**.
4. Create the Coinsnap service-plugin files.
5. Copy the source code from this repository into the Wix code editor.
6. Add the backend HTTP functions required for webhook handling.
7. Publish the Wix changes.
8. Connect Coinsnap under **Settings → Accept Payments**.
9. Enter the required Store ID, API key and webhook secret.
10. Configure BTCPay Server or the optional Bitcoin discount if required.
11. Perform a test transaction before going live.

## Coinsnap or BTCPay Server

The Wix integration can be used with two payment-provider setups:

- **Coinsnap** — for merchants who want to accept Bitcoin without operating their own Bitcoin or Lightning payment infrastructure.
- **BTCPay Server** — for merchants who want to use their own BTCPay Server and retain full control over their payment infrastructure.

## Bitcoin discount

The Wix Bitcoin payment integration supports an optional discount for customers who choose Bitcoin or Lightning at checkout.

Merchants can configure either:

- a **percentage-based discount**, or
- a **fixed discount**

This can be used to encourage customers to choose Bitcoin as their payment method.

## Installation

### 1. Enable Wix Developer Mode

Open your Wix site in the Wix Editor and enable **Dev Mode**.

### 2. Add the payment provider service plugin

In the Wix code editor:

1. Open **Service Plugins**.
2. Click **Add**.
3. Select **Payment**.
4. Start the setup.
5. Accept the Wix terms.
6. Name the service plugin **Coinsnap**.
7. Choose **Add & Edit Code**.

Wix creates the service-plugin files for the payment provider.

### 3. Add the Coinsnap source code

Copy the corresponding source code from this repository into the Wix-generated files.

The repository includes the code required for:

- the Coinsnap payment provider
- the provider configuration
- backend HTTP functions used for webhook handling

Remove Wix example code before pasting the Coinsnap implementation.

### 4. Add backend HTTP functions

In the Wix backend section, create or open `http-functions.js`.

Add the Coinsnap webhook code from this repository. If the file already contains other site functions, append the Coinsnap functions without removing your existing code.

### 5. Publish the site

Publish the Wix site so the custom payment provider becomes available in the dashboard.

## Configuration

In the Wix dashboard:

1. Go to **Settings → Accept Payments**.
2. Find **Bitcoin / Lightning with Coinsnap**.
3. Click **Connect**.
4. Enter your:
   - **Store ID**
   - **API key**
   - **Webhook secret**
5. Save the configuration.

Your Coinsnap Store ID and API key are available in your Coinsnap merchant account.

### Webhook setup

Create a webhook in your Coinsnap merchant account using your Wix site URL together with the Coinsnap callback path.

A typical callback URL follows this pattern:

`https://example.com/_functions/post_coinsnapWebhook`

Replace `example.com` with your Wix domain.

Copy the generated webhook secret into the corresponding Wix Coinsnap configuration field.

## Free integration service

If you do not want to perform the Wix developer setup yourself, Coinsnap offers a **free integration service** that can install and configure the Wix Bitcoin payment integration for you.

## Resources

- [Coinsnap for Wix product page](https://coinsnap.io/shop-systems/wix/)
- [Wix Bitcoin user guide](https://www.coinsnap.io/user-guides/wix-bitcoin-user-guide/)
- [Coinsnap Wix demo store](https://wix.coinsnap.org/)
- [Coinsnap Wallet](https://coinsnap.io/wallet/)
- [Coinsnap API documentation](https://docs.coinsnap.io/)
- [Coinsnap merchant account](https://app.coinsnap.io/register)
- [Coinsnap website](https://coinsnap.io/)
- [Telegram community and support](https://t.me/coinsnap)

> **Brand note:** Coinsnap is Bitcoin payment software for merchants and is not the provider of the similarly named coin identifier app "CoinSnap".

## Frequently Asked Questions

### Does Wix support Bitcoin payments natively?

No. The Coinsnap integration uses Wix's developer framework to add a custom Bitcoin payment provider to the Wix checkout.

### Can customers pay with both Lightning and Bitcoin on-chain?

Yes. The Wix integration supports Bitcoin payments via both the Lightning Network and Bitcoin on-chain.

### Can I use my own BTCPay Server?

Yes. The current Wix integration supports BTCPay Server as an alternative payment-provider setup.

### Can I offer a Bitcoin discount?

Yes. Merchants can configure a fixed or percentage-based discount for Bitcoin payments.

### Do I need my own Lightning node?

No. When using Coinsnap, you do not need to operate your own Lightning node or Bitcoin payment server.

### Which Bitcoin or Lightning wallets can I use?

You can use a compatible Bitcoin or Lightning wallet for settlement. One option is the [Coinsnap Wallet](https://coinsnap.io/wallet/).

Other compatible wallets may include solutions such as Wallet of Satoshi, Blink and Zeus, depending on the settlement setup you choose.

### Does Coinsnap hold my Bitcoin?

Coinsnap follows a non-custodial approach and does not hold merchant Bitcoin. Payments are settled to the merchant's configured wallet or payment destination.

### Can I receive settlement in euros?

Depending on the merchant setup and supported partner integrations, Bitcoin payments can also be converted and settled to a bank account.

### Do I need to write the Wix code myself?

No. You can follow the step-by-step setup and copy the provided source files, or use Coinsnap's free integration service.

### Is the integration open source?

Yes. The source code is available in this repository under the MIT License.

### Where can I get support?

Use the support area in your Coinsnap merchant account or join the official [Coinsnap Telegram channel](https://t.me/coinsnap).
