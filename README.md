# TapWash Premium

You are an expert SaaS architect and senior full-stack engineer.



Build a premium SaaS platform called TapWash CRM.



This platform is for a professional car wash company in Egypt using NFC cards, NFC keychains and NFC stickers.



The platform must support both Arabic (RTL) and English (LTR).



Create a modern luxury UI using white, black and blue.



The design should look premium like Stripe, Notion and Linear.



====================================



Create these pages:



Home



About Us



Services



Offers



Packages



Contact



Login



Customer Dashboard



Admin Dashboard



====================================



Customer Dashboard:



Display:



Customer Name



Profile Image



Membership Package



Subscription Status



Subscription Start Date



Subscription End Date



Remaining Washes



Used Washes



Last Wash Date



Renew Subscription Button



WhatsApp Button



Call Button



Edit Profile



Change Password



Language Switcher



NO analytics should be visible to customers.



====================================



Admin Dashboard



The admin has full control.



Dashboard



Customers



NFC Cards



Packages



Offers



Pages



Settings



Employees



Subscriptions



Payments



Notifications



Reports



====================================



Customers



Add



Edit



Delete



Suspend



Activate



Assign Package



Assign NFC Card



Add Washes



Remove Washes



View History



====================================



NFC Cards



Each card has



UUID



Serial Number



Card Type



(Card / Sticker / Keychain)



Status



Assigned Customer



Activation Date



====================================



Packages



Image



Title



Price



Duration



Number of Washes



Description



Features



Status



====================================



Offers



Image



Title



Description



Old Price



New Price



Start Date



End Date



Status



====================================



Pages



Admin can edit every page without code.



====================================



Settings



Company Logo



Company Name



Phone



WhatsApp



Email



Address



Social Links



Primary Color



Secondary Color



====================================



Create responsive design.



Dark Mode ready.



Professional animations.



Arabic RTL support.



English support.



Do not use dummy pages.



Everything should be connected.



Prepare the project for Supabase integration.

## Deployment

TapWash is intended to deploy through **Cloudflare Workers**. Branch changes are previewed through the connected Cloudflare Git integration; production deployment follows the production branch configured in Cloudflare. Keep security changes in a reviewable pull request and do not push directly to `main`.

Supabase schema migrations are **not** applied by a successful Worker deployment. Review and validate migrations against a staging database before applying them to production.

The server-side admin bootstrap is fail-closed. If a new environment has no admin, set `TAPWASH_INITIAL_ADMIN_EMAIL` in the server/Worker environment to the verified email address allowed to claim the first admin role. Do not put service-role keys or other secrets in client-side variables or commit them to Git.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

<!-- temporary NFC workflow trigger -->
