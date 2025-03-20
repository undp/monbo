## Deploy

### Deploy on AWS

TODO

### Deploy on Vercel

1. Create an account on the [Vercel website](https://vercel.com).
2. Install the Vercel CLI:
   ```sh
   npm install -g vercel
   ```
3. Log in to your account using:
   ```sh
   vercel login
   ```
4. Each time you want to deploy a new version, use:
   ```sh
   vercel deploy
   ```

#### Setting Environment Variables

To set up environment variables, follow these steps:

1. Go to the Project Settings on the Vercel dashboard.
2. Navigate to the Environment Variables section in the left-hand menu.
3. Add the required variable keys and their corresponding values.

For reference, check the `.env.template` file in your project to see which variables are needed.
