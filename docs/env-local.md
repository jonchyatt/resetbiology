# Local Environment Configuration

.env.local is a file you place in the project root (same folder as package.json) for local-only environment variables. Next.js ignores it in git by default. 

For Reset Biology, create `.env.local` with these variables for local development:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=dev-xxxx.us.auth0.com
AUTH0_ISSUER_BASE_URL=https://dev-xxxx.us.auth0.com
AUTH0_BASE_URL=http://localhost:3000
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=your_secret

# MongoDB Atlas (same for local/prod)
DATABASE_URL=mongodb+srv://user:pass@cluster0.weld7bm.mongodb.net/resetbiology?retryWrites=true&w=majority&appName=Cluster0

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_PRICE_ID=price_...
```

After creating `.env.local`, run:
- `npm i && npx prisma generate && npm run dev`
- Test login at: http://localhost:3000/api/auth/login