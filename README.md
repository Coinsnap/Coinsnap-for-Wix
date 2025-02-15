# Coinsnap for Wix payment plugin

![Coinsnap for Wix](https://resources.coinsnap.org/products/wix/images/cover.png)

* Contributors: coinsnap
* Tags: Lightning, Lightning Payment, SATS, Satoshi sats, bitcoin, Wordpress, Wix, accept bitcoin, bitcoin payment processor, bitcoin e-commerce, Lightning Network, cryptocurrency, lightning payment processor
* Requires Wix: Core Premium plan
* Stable tag: 1.1.1
* License: GPL2
* License URI: https://www.gnu.org/licenses/gpl-2.0.html


## Accept Bitcoin and Lightning Payments with Wix

The Coinsnap for Wix plugin allows you to accept Bitcoin and Lightning payments in e-store, created on Wix platform. Please follow the steps below and copy and paste the code into your Wix editor to set up payments via Coinsnap payment gateway.

* Coinsnap for JTL Demo Site: [https://wix.coinsnap.org/](https://wix.coinsnap.org/)
* Blog Article: [https://coinsnap.io/coinsnap-for-wix/](https://coinsnap.io/coinsnap-for-wix/)
* GitHub: [https://github.com/Coinsnap/Coinsnap-for-Wix/](https://github.com/Coinsnap/Coinsnap-for-Wix/)


### Requirements

You have a **Wix** account (at least **Core Premium plan**) and online store up and running. 

### Steps to Integrate Coinsnap as a Payment Provider in Wix

1. **Enable Developer Mode**

In your Wix site, open the **Wix Editor**.

At the top, click on **Dev Mode** and then click the **Turn on Dev Mode** button to enable developer mode.

![Enable Developer Mode](https://resources.coinsnap.org/products/wix/images/screenshot1-Wix-Velo-Dev-Mode.png)

2. **Open the Code Editor**

On the left side, click on the **{ } icon** to open the code editor.

![Open the Code Editor](https://resources.coinsnap.org/products/wix/images/screenshot2-Wix-Velo-Code-Editor.png)

3. **Add Payment Provider Service Plugin**

In the **Service Plugins** section, click on the **(+)** sign and select **Payment** to add a payment provider service plugin.

![Add Payment Provider Service Plugin](https://resources.coinsnap.org/products/wix/images/screenshot3-Wix-New-Service-Plugin.png)

4. **Start Setup**

On the following screen, click **Start now**.

![Start Setup](https://resources.coinsnap.org/products/wix/images/screenshot4-Wix-Start-Setup.png)

5. **Accept Terms**

On the legal terms page, check the terms and click **Accept**.

![Accept Terms](https://resources.coinsnap.org/products/wix/images/screenshot5-Wix-Legal-Notice.png)

6. **Name the Plugin**

Enter the name of the plugin: **Coinsnap** (you can use any name, but this will make it easier to follow the guide).

Click **Add & Edit Code**.

![Accept Terms](https://resources.coinsnap.org/products/wix/images/screenshot6-Wix-Name-Plugin.png)

7. **Locate Created Files**

This creates a directory named **Coinsnap** containing two files: `Coinsnap.js` and `Coinsnap-config.js`, which will open in the editor.

![Accept Terms](https://resources.coinsnap.org/products/wix/images/screenshot7-Wix-Locate-Coinsnap-files.png)

8. **Copy Code to `Coinsnap-config.js`**

In `Coinsnap-config.js`, paste the code from our Git repository. Click the **Copy raw file** icon to easily copy the code.

Make sure to delete any example code in `Coinsnap-config.js` in the Wix editor before pasting the new code.

![Copy Code to `Coinsnap-config.js`](https://resources.coinsnap.org/products/wix/images/screenshot8-Wix-Coinsnap-config.png)

9. **Copy Code to `Coinsnap.js`**

Open `Coinsnap.js` in the Wix editor and paste the code from our Git repository.

Delete all example code from `Coinsnap.js` before pasting the new code.

![Copy Code to `Coinsnap.js`](https://resources.coinsnap.org/products/wix/images/screenshot9-Wix-Coinsnap.png)

10. **Add `http-functions.js` to the Backend Directory**

In the **backend** section of your editor, click on the **(+) icon** and select **Expose Site API**, which creates an `http-functions.js` file. (If this file already exists, you can skip this step.)

Copy the code from our Git repository into `http-functions.js`. If `http-functions.js` already exists, add the code from GitHub below the existing code. If not, delete any example code before pasting.

![Add `http-functions.js` to the Backend Directory](https://resources.coinsnap.org/products/wix/images/screenshot10-Wix-Backend-http-functions.png)

11. **Publish Changes**

Once the code is complete, click **Publish** to save the changes and make the plugin available.

![Publish Changes](https://resources.coinsnap.org/products/wix/images/screenshot11-Wix-Publish-Changes.png)

### Configure the Payment Service Provider Plugin (PSPP)

12. **Set Up Payment Configuration**

Go to your site's dashboard, and in the left menu, click on **Settings**.

On the Settings page, click **Accept Payments**.

![Set Up Payment Configuration](https://resources.coinsnap.org/products/wix/images/screenshot12-Wix-Accept-Payments.png)

13. **Connect Coinsnap as Payment Provider**

On the following page, you should see **Bitcoin/Lightning with Coinsnap** as a payment provider. If not, refresh the page to clear the Wix cache.

Click **Connect** next to Coinsnap.

![Connect Coinsnap as Payment Provider](https://resources.coinsnap.org/products/wix/images/screenshot13-Wix-Payment-Methods.png)

14. **Enter Configuration Details**

You will be prompted to enter the following fields:

  - **API Key**
  - **Store ID**
  - **Webhook Secret**

![Enter Configuration Details](https://resources.coinsnap.org/products/wix/images/screenshot14-Coinsnap-Configuration-Settings.png)

### Store ID and API Key

In your Wix store: paste that Store ID into the "**Store ID**" field and API key into the "**API Key**" field

![Store ID and API Key](https://resources.coinsnap.org/products/wix/images/screenshot14.1-StoreID-API-Key.png)

### Webhook Secret

1. Go back to your Coinsnap store and "Create Webhook"

![Create Webhook](https://resources.coinsnap.org/products/wix/images/screenshot14.2-New-Webhook.png)

2. **Payload URL**: Your Wix store URL where it can be reached combined with a callback path. E.g. `https://example.com/_functions/post_coinsnapWebhook` (replace example.com with your Wix store URL)

![Webhook Creation](https://resources.coinsnap.org/products/wix/images/screenshot14.3-Webhook-Creation.png)

3. **Secret**: left this field empty and press the button "**Save Changes**".

![Webhook Secret](https://resources.coinsnap.org/products/wix/images/screenshot14.4-Webhook-Secret.png)

4. Find your webhook in webhooks list, press "Modify" button. Value for Secret field will be auto-generated by Coinsnap, you can see it by clicking on the "eye" icon. Copy the "**Secret**" and paste it into the "**Webhook Secret**" field in your Wix store e.g. 'YOURWEBHOOKSECRET' as shown in our example.

### Save the configuration

Back in your Wix store, click on "**Connect**" to save the configuration

More information:

* Wix Shop Coinsnap Demo Site: https://wix.coinsnap.org/
* Blog Article: https://coinsnap.io/en/coinsnap-for-wix/
* GitHub: https://github.com/Coinsnap/Coinsnap-for-Wix 

# Features: #

* **All you need is your email and a Lightning Wallet with a Lightning address. [Here you can find an overview of suitable Lightning Wallets](https://coinsnap.io/en/lightning-wallet-with-lightning-address/)**

* **Accept Bitcoin and Lightning payments** in your online store **without running your own technical infrastructure.** You do not need your own server, nor do you need to run your own Lightning Node. You also do not need a shop-system, for you can sell right out of your forms using the Coinsnap for Content Form 7-plugin.

* **Quick and easy registration at Coinsnap**: Just enter your email address and your Lightning address – and you are ready to integrate the payment module and start selling for Bitcoin Lightning. You will find the necessary IDs and Keys in your Coinsnap account, too.

* **100% protected privacy**:
    * We do not collect personal data.
    * For the registration you only need an e-mail address, which we will also use to inform you when you have received a payment.
    * No other personal information is required as long as you request a withdrawal to a Lightning address or Bitcoin address.

* **Only 1 % fees!**:
    * No basic fee, no transaction fee, only 1% on the invoice amount with referrer code.
    * Without referrer code the fee is 1.25%.
    * Get a referrer code from our [partners](https://coinsnap.io/en/partner/) and customers and save 0.25% fee.

* **No KYC needed**:
    * Direct, P2P payments (instantly to your Lightning wallet)
    * No intermediaries and paperwork
    * Transaction information is only shared between you and your customer

* **Sophisticated merchant’s admin dashboard in Coinsnap:**:
    * See all your transactions at a glance
    * Follow-up on individual payments
    * See issues with payments
    * Export reports

* **A Bitcoin payment via Lightning offers significant advantages**:
    * Lightning **payments are executed immediately.**
    * Lightning **payments are credited directly to the recipient.**
    * Lightning **payments are inexpensive.**
    * Lightning **payments are guaranteed.** No chargeback risk for the merchant.
    * Lightning **payments can be used worldwide.**
    * Lightning **payments are perfect for micropayments.**

* **Multilingual interface and support**: We speak your language


# Documentation: #

* [Coinsnap API (1.0) documentation](https://docs.coinsnap.io/)
* [Frequently Asked Questions](https://coinsnap.io/en/faq/) 
* [Terms and Conditions](https://coinsnap.io/en/general-terms-and-conditions/)
* [Privacy Policy](https://coinsnap.io/en/privacy/)
