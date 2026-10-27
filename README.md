# KULUF Total Security

Full-stack KULUF smart-security e-commerce application starter.

## Stack
- React + Vite
- Node.js + Express
- SQLite + better-sqlite3
- JWT authentication
- Multer image uploads
- Razorpay integration endpoint
- Responsive custom CSS

## Run with npm

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set a strong `JWT_SECRET`.
4. Optionally add Razorpay keys.
5. Run:

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:4000

Default admin:
Email: admin@kuluf.com
Password: ChangeThisPassword123!

Change the admin password before deployment.

## Product images

The application accepts uploaded product images from the admin dashboard and stores them in `server/uploads`.

The reference design's lifestyle/hero assets are not embedded in this package. Put your licensed KULUF images in `server/uploads` with names such as:

- hero-lock.jpg
- about-hero.jpg
- about-office.jpg
- about-lock.jpg
- lifestyle.jpg
- vision.jpg
- product-default.jpg
- category-home.jpg
- category-office.jpg
- category-commercial.jpg
- category-access.jpg
- category-digital.jpg
- category-smart.jpg

If an asset is missing, the page still loads but the corresponding image area will be empty.

## Production notes

This package implements the core real storefront/admin architecture. Before public deployment, configure:
- HTTPS
- strong secrets
- production database/storage
- transactional email provider
- Razorpay verification/webhooks
- backup strategy
- rate limiting/WAF
- production image/object storage
- shipping carrier integration if required
- privacy/legal content
- real KULUF product/catalog data

Do not use the default admin password in production.

## Important
Live Razorpay payment capture/verification requires adding Razorpay credentials and implementing provider webhook/signature verification before public launch. The included API intentionally refuses to pretend payment is successful when credentials are absent.
